"use client"
import { useEffect } from "react"
import Link from "next/link"

// Route-level error boundary for /plan/[id]. Without this, any client-side
// render/hydration error shows a blank white "Application error" screen. Now a
// failure degrades gracefully with a retry and a way back.
export default function PlanError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface the real error in the console for debugging.
    console.error("Plan page error:", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "hsl(240,25%,4%)" }}>
      <div className="text-center max-w-md">
        <p className="text-5xl mb-4">😕</p>
        <h1 className="text-xl font-bold text-white mb-2">Something went wrong displaying this plan</h1>
        <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.45)" }}>
          The plan data loaded, but the page hit a rendering error. Trying again usually fixes it.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer"
            style={{ background: "hsl(258,85%,64%)" }}>
            ↻ Try again
          </button>
          <Link
            href="/generate"
            className="px-5 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.12)" }}>
            Generate a new plan
          </Link>
        </div>
      </div>
    </div>
  )
}
