// InsForge browser client (TypeScript SDK).
//
// Used for the live plan page: it opens one Socket.IO connection and subscribes
// to the `plan:<id>` channel. A Postgres trigger (migrations/002) calls
// realtime.publish() on every plan UPDATE, so the page updates live on any
// device — no SSE connection of its own required.
//
// The anon key is a stable, non-expiring public token (role "anon"); it's safe
// to expose in the browser. If env vars are missing (e.g. during a build with
// no InsForge configured), `insforge` is null and all realtime code no-ops.
import { createClient } from "@insforge/sdk"

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY

export const insforge =
  baseUrl
    ? createClient({ baseUrl, anonKey: anonKey ?? undefined })
    : null
