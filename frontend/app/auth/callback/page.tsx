"use client"
import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { insforge } from "@/lib/insforge"

function saveUserLocally(user: { id?: string; email?: string; name?: string }, accessToken?: string) {
  const name = user.name || user.email?.split("@")[0] || "User"
  const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
  localStorage.setItem("pitchcraft_user", JSON.stringify({
    name, email: user.email || "", initials, id: user.id, accessToken,
  }))
}

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    const code = searchParams.get("insforge_code")
    const errorParam = searchParams.get("insforge_status")

    if (errorParam === "error") {
      const desc = searchParams.get("insforge_error") || "OAuth failed"
      setErrorMsg(desc)
      setStatus("error")
      return
    }

    if (!code) {
      // No code — might be a direct navigation; redirect to login
      router.replace("/login")
      return
    }

    if (!insforge) {
      setErrorMsg("Auth not configured")
      setStatus("error")
      return
    }

    const verifier = sessionStorage.getItem("pkce_verifier") || undefined
    const redirectTo = sessionStorage.getItem("oauth_redirect") || "/generate"

    insforge.auth.exchangeOAuthCode(code, verifier)
      .then(result => {
        const user = result?.data?.user
        const token = result?.data?.accessToken
        if (!user) throw new Error("Exchange returned no user")
        saveUserLocally(user, token)
        sessionStorage.removeItem("pkce_verifier")
        sessionStorage.removeItem("oauth_redirect")
        router.replace(redirectTo)
      })
      .catch((e: unknown) => {
        setErrorMsg((e as { message?: string })?.message || "OAuth sign-in failed")
        setStatus("error")
      })
  }, [router, searchParams])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: "hsl(240,25%,4%)" }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: "rgba(124,58,237,0.3)", borderTopColor: "hsl(258,85%,64%)" }} />
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Completing sign-in…
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6"
      style={{ background: "hsl(240,25%,4%)" }}>
      <div className="rounded-2xl p-8 max-w-sm w-full text-center"
        style={{ background: "hsl(240,15%,8%)", border: "1px solid rgba(239,68,68,0.3)" }}>
        <p className="text-3xl mb-4">⚠️</p>
        <p className="text-sm font-semibold text-white mb-2">Sign-in failed</p>
        <p className="text-xs mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>{errorMsg}</p>
        <button
          onClick={() => router.replace("/login")}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white cursor-pointer"
          style={{ background: "hsl(258,85%,64%)" }}>
          Back to login
        </button>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "hsl(240,25%,4%)" }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: "rgba(124,58,237,0.3)", borderTopColor: "hsl(258,85%,64%)" }} />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}
