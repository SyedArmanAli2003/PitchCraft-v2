/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ["three"],

  // Bake the InsForge project constants into the bundle at build time.
  // These override env vars — guaranteed to be present even when Vercel's build
  // environment doesn't pass NEXT_PUBLIC_* vars through to the Next.js build.
  env: {
    NEXT_PUBLIC_INSFORGE_URL:
      process.env.NEXT_PUBLIC_INSFORGE_URL ||
      "https://nb3y5334.us-east.insforge.app",
    NEXT_PUBLIC_INSFORGE_ANON_KEY:
      process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzY3OTd9.gZZV1BU70UgtUit3FnGXBNbVuvLIQNFZoVHlZ_iZT3g",
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || "",
  },

  // Self-contained server bundle — only for Docker/Fly.io (set BUILD_STANDALONE=true).
  // On Vercel we must NOT use standalone: its file-tracing step OOMs the builder
  // (causes BUILD_UTILS_SPAWN_1) and Vercel produces its own optimized output.
  ...(process.env.BUILD_STANDALONE === "true" ? { output: "standalone" } : {}),

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Dev proxy: /api/* → FastAPI on port 8000
  async rewrites() {
    if (process.env.NODE_ENV === "development") {
      return [
        { source: "/api/:path*", destination: "http://localhost:8000/api/:path*" },
        { source: "/health",     destination: "http://localhost:8000/health" },
      ]
    }
    return []
  },
}

export default config
