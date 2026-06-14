/**
 * InsForge browser client.
 *
 * NEXT_PUBLIC_* env vars must be present at Next.js build time to be inlined
 * into the JS bundle. We fall back to hardcoded project constants so the client
 * always initialises even when env vars are missing from the build environment.
 */
import { createClient } from "@insforge/sdk"

// Hardcoded project values (safe to expose — these are public endpoints/keys)
const INSFORGE_URL_DEFAULT  = "https://nb3y5334.us-east.insforge.app"
const INSFORGE_ANON_DEFAULT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzY3OTd9.gZZV1BU70UgtUit3FnGXBNbVuvLIQNFZoVHlZ_iZT3g"

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL || INSFORGE_URL_DEFAULT
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || INSFORGE_ANON_DEFAULT

export const insforge = createClient({ baseUrl, anonKey })

// Convenience: backend API base (for Shark Tank and other direct API calls)
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  "https://pitchcraft-api-4cecea40-48ff-439f-a853-2b9029124c34.fly.dev"
