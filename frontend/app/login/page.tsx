"use client"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { insforge } from "@/lib/insforge"

// ── Session helpers ──────────────────────────────────────────────────────────
interface LocalUser { name: string; email: string; initials: string; id?: string; accessToken?: string }

function saveUserLocally(user: { id?: string; email?: string; name?: string }, accessToken?: string | null) {
  const name = user.name || user.email?.split("@")[0] || "User"
  const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
  const data: LocalUser = { name, email: user.email || "", initials, id: user.id, accessToken: accessToken ?? undefined }
  localStorage.setItem("pitchcraft_user", JSON.stringify(data))
}



// ── Login form ───────────────────────────────────────────────────────────────
function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")

  const redirectTo = searchParams.get("redirect") || "/generate"

  // Redirect already-logged-in users
  useEffect(() => {
    try {
      if (localStorage.getItem("pitchcraft_user")) router.replace(redirectTo)
    } catch { /* SSR */ }
  }, [router, redirectTo, searchParams])


  // ── Email / password ──────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(""); setInfo("")
    if (!email.trim() || !email.includes("@")) { setError("Enter a valid email address."); return }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return }
    if (mode === "signup" && !name.trim()) { setError("Please enter your name."); return }
    if (!insforge) { setError("Auth client not initialised — check env vars."); return }

    setLoading(true)
    try {
      if (mode === "signup") {
        // Step 1: create account
        const { data: signUpData, error: signUpErr } = await insforge.auth.signUp({
          email: email.trim(), password, name: name.trim(),
        })
        if (signUpErr) throw signUpErr
        if (!signUpData) throw new Error("Sign up failed — try again.")

        // Step 2: sign in immediately (email verification is disabled)
        const { data: sessionData, error: signInErr } = await insforge.auth.signInWithPassword({
          email: email.trim(), password,
        })
        if (signInErr || !sessionData?.user) {
          // Account created but sign-in failed (shouldn't happen without verification)
          setInfo("Account created! Please sign in below.")
          setMode("signin")
          setPassword("")
          return
        }
        saveUserLocally(sessionData.user, sessionData.accessToken)
        router.replace(redirectTo)
      } else {
        const { data, error: signInErr } = await insforge.auth.signInWithPassword({
          email: email.trim(), password,
        })
        if (signInErr) throw signInErr
        if (!data?.user) throw new Error("Sign in failed — check your credentials.")
        saveUserLocally(data.user, data.accessToken)
        router.replace(redirectTo)
      }
    } catch (e: unknown) {
      const raw = (e as { message?: string; code?: string })
      const msg = raw?.message || "Something went wrong."
      const code = raw?.code || ""
      if (code === "INVALID_CREDENTIALS" || msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credentials")) {
        setError("Invalid email or password.")
      } else if (code === "USER_EXISTS" || msg.toLowerCase().includes("already")) {
        setError("An account with this email already exists.")
        setMode("signin"); setPassword("")
      } else if (code === "EMAIL_NOT_VERIFIED" || msg.toLowerCase().includes("verif")) {
        setError("Please verify your email first — check your inbox.")
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(m => m === "signin" ? "signup" : "signin")
    setError(""); setInfo("")
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16"
      style={{ background: "hsl(240,25%,4%)" }}>

      {/* Back to home */}
      <a href="/"
        className="fixed top-5 left-8 text-sm no-underline transition-colors"
        style={{ color: "rgba(255,255,255,0.32)" }}
        onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.65)")}
        onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.32)")}>
        ← PitchCraft
      </a>

      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 mb-6 cursor-pointer"
            onClick={() => router.push("/")}>
            <span style={{ color: "hsl(258,90%,66%)", fontSize: "1.5rem" }}>✦</span>
            <span className="text-2xl font-semibold text-white">
              Pitch<span style={{ color: "hsl(258,90%,66%)" }}>Craft</span>
            </span>
          </div>
          <h1 className="text-xl font-semibold text-white mb-1.5">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.38)" }}>
            {mode === "signin" ? "Sign in to generate business plans" : "Free — no credit card needed"}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7"
          style={{ background: "hsl(240,15%,8%)", border: "1px solid rgba(255,255,255,0.08)" }}>


          {/* Email + Password form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              {mode === "signup" && (
                <FieldGroup label="Full name">
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Alex Johnson"
                    autoComplete="name"
                    className="w-full rounded-lg px-4 py-3 text-sm text-white outline-none"
                    style={{ background: "hsl(240,15%,6%)", border: "1px solid rgba(255,255,255,0.08)", caretColor: "hsl(258,90%,66%)" }}
                    onFocus={e => (e.target.style.borderColor = "rgba(124,58,237,0.5)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                  />
                </FieldGroup>
              )}
              <FieldGroup label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="w-full rounded-lg px-4 py-3 text-sm text-white outline-none"
                  style={{ background: "hsl(240,15%,6%)", border: "1px solid rgba(255,255,255,0.08)", caretColor: "hsl(258,90%,66%)" }}
                  onFocus={e => (e.target.style.borderColor = "rgba(124,58,237,0.5)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                />
              </FieldGroup>
              <FieldGroup label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  className="w-full rounded-lg px-4 py-3 text-sm text-white outline-none"
                  style={{ background: "hsl(240,15%,6%)", border: "1px solid rgba(255,255,255,0.08)", caretColor: "hsl(258,90%,66%)" }}
                  onFocus={e => (e.target.style.borderColor = "rgba(124,58,237,0.5)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                />
              </FieldGroup>
            </div>

            {/* Info / error banners */}
            {info && (
              <div className="mt-3 rounded-lg px-3 py-2"
                style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <p className="text-xs" style={{ color: "rgb(74,222,128)" }}>✓ {info}</p>
              </div>
            )}
            {error && (
              <div className="mt-3 rounded-lg px-3 py-2"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)" }}>
                <p className="text-xs" style={{ color: "rgb(252,165,165)" }}>⚠ {error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-5 py-3.5 rounded-xl font-semibold text-white text-sm cursor-pointer transition-all disabled:opacity-55 disabled:cursor-not-allowed"
              style={{ background: "hsl(258,85%,64%)" }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = "0 0 24px rgba(124,58,237,0.4)" }}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "white" }} />
                    Just a moment…
                  </span>
                : mode === "signin" ? "Sign in →" : "Create account →"}
            </button>
          </form>
        </div>

        {/* Toggle mode */}
        <p className="text-center text-sm mt-5" style={{ color: "rgba(255,255,255,0.38)" }}>
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={switchMode}
            className="cursor-pointer font-medium"
            style={{ color: "hsl(258,80%,78%)", background: "none", border: "none" }}>
            {mode === "signin" ? "Sign up free" : "Sign in"}
          </button>
        </p>

        <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.18)" }}>
          Powered by InsForge · Launch Week 2 Hackathon 2026
        </p>
      </div>
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.42)" }}>{label}</label>
      {children}
    </div>
  )
}


export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ background: "hsl(240,25%,4%)", minHeight: "100vh" }} />}>
      <LoginContent />
    </Suspense>
  )
}
