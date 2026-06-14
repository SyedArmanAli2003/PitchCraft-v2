<div align="center">

# ✦ PitchCraft

### Turn one sentence into an investor-ready business plan — with a 7-agent team you can actually supervise.

**A multi-agent AI system (Google ADK) where seven named specialists hand off to each other — grounded in InsForge Postgres over MCP, traced end-to-end in Arize Phoenix, and sealed with a tamper-evident audit chain.**



![Gemini](https://img.shields.io/badge/Gemini-3.5%20Flash%20%2B%20cascade-7c3aed)
![Google ADK](https://img.shields.io/badge/Google%20ADK-LlmAgent%20%2B%20SequentialAgent-4285F4)
![InsForge](https://img.shields.io/badge/InsForge-Postgres%20%2B%20Realtime%20%2B%20Auth%20%2B%20AI-06b6d4)
![NVIDIA NIM](https://img.shields.io/badge/NVIDIA%20NIM-Llama%203.3%2070B-76b900)
![OpenRouter](https://img.shields.io/badge/OpenRouter-Free%20Models-FF6B6B)
![Arize Phoenix](https://img.shields.io/badge/Arize-Phoenix%20OpenInference-ff6a00)
![Next.js 14](https://img.shields.io/badge/Next.js-14-000000)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

**🔗 Live demo:** [nb3y5334.insforge.site](https://nb3y5334.insforge.site) · **🖥️ Backend API:** [pitchcraft-api.fly.dev](https://pitchcraft-api-4cecea40-48ff-439f-a853-2b9029124c34.fly.dev/api/health) · **💻 Repo:** [github.com/SyedArmanAli2003/PitchCraft-v2](https://github.com/SyedArmanAli2003/PitchCraft-v2) · **🧩 Architecture:** _/api/agent/manifest_

</div>

---

## The problem

Founders, students, and small teams have ideas constantly — but turning an idea into something you can *act on or pitch* (market sizing, personas, financials, risk) takes days of research and a blank-page tax most people never pay. Generic chatbots give you one wall of text with no structure, no grounding in real data, no record of how they reached their conclusions, and **no point at which a human can step in and steer.**

PitchCraft is the opposite of a chatbot. It's a **team of agents that does the work** — seven named specialists (defined with Google's Agent Development Kit) that hand off to each other, call tools, pause for your approval at the decision point, and produce a structured, verifiable plan.

> **One idea in → a full, structured, auditable business plan out — in about a minute.**

---

## What's new in v2

PitchCraft v2 is a ground-up infrastructure migration with new features layered on top:

| Area | v1 | v2 |
|---|---|---|
| **Database** | MongoDB Atlas | **InsForge Postgres** (PostgREST REST + JSONB) |
| **Realtime** | polling | **InsForge Realtime** — Postgres-trigger WebSocket push on every plan update |
| **Auth** | none | **InsForge Auth** — JWT-based user accounts, protected `/history` route |
| **Model gateway** | direct Gemini only | **3-tier cascade**: Gemini → NVIDIA NIM → InsForge/OpenRouter free models |
| **Hosting** | Cloud Run + Vercel | **InsForge Compute** (Fly.io) + InsForge Sites / Vercel |
| **Admin** | none | `/admin` dashboard — all plans, user stats, approval queue |
| **Plan history** | none | `/history` — per-user plan list, persistent across sessions |
| **Frontend SDK** | none | `@insforge/sdk` for database reads, realtime subscriptions, auth |

---

## Meet the agents (multi-agent architecture)

Seven named specialists, defined with Google ADK and composed into a single
`SequentialAgent` pipeline. They hand off in sequence, sharing a context object —
the canonical ADK "agents that collaborate" pattern.

```
User idea
    │
    ▼
PitchCraftOrchestra  (ADK SequentialAgent: "pitchcraft_orchestra")
    │
    ├─ ①  Strategy Analyst             (LlmAgent)            validate viability
    ├─ ②  Market Intelligence Analyst  (LlmAgent + MCP)      ← InsForge Postgres
    │        ⏸  HUMAN APPROVAL GATE — approve / reject / redirect
    ├─ ③  Customer Insights Specialist (LlmAgent)            3 personas
    ├─ ④  Business Architect           (LlmAgent)            full plan
    ├─ ⑤  Financial Modeller           (LlmAgent + MCP)      ← InsForge Postgres benchmarks
    ├─ ⑥  Risk & Compliance Officer    (LlmAgent)            risk + SWOT
    └─ ⑦  Chief of Staff               (compile/persist)     ← InsForge + SHA-256 audit
    │
    ▼
Plan saved + shareable + audit chain sealed
```

| # | Agent (`adk_name`) | Role | Tools |
| - | --- | --- | --- |
| 1 | **Strategy Analyst** (`strategy_analyst`) | Validates idea viability | Gemini reasoning |
| 2 | **Market Intelligence Analyst** (`market_intelligence_analyst`) | Researches the market | **MCP** `get_industry_market_data`, `search_similar_plans` → InsForge |
| 3 | **Customer Insights Specialist** (`customer_insights_specialist`) | Builds personas | Gemini reasoning |
| 4 | **Business Architect** (`business_architect`) | Writes the plan | Gemini reasoning |
| 5 | **Financial Modeller** (`financial_modeller`) | 3-yr financials | **MCP** `get_market_benchmarks` → InsForge |
| 6 | **Risk & Compliance Officer** (`risk_compliance_officer`) | Risk + SWOT | Gemini reasoning |
| 7 | **Chief of Staff** (`chief_of_staff`) | Compile, persist, seal | `insforge_persist`, `sha256_audit_chain` |

> **Execution note:** ADK defines the agents and pipeline topology; Gemini calls run
> through PitchCraft's resilient executor (multi-key rotation + 3-tier cascade +
> forced-JSON + Arize tracing) so a live demo never dies on one model's quota.
> See the live wiring at **`GET /api/agent/manifest`**.

---

## What the agents do — the 7 steps

```
Idea ─▶ ① Validate ─▶ ② Market Research ─▶ ⏸ HUMAN APPROVAL GATE ─▶ ③ Personas
                         (InsForge grounding)  (approve / reject / redirect)        │
                                                                                     ▼
        ⑦ Finalize + seal audit chain ◀─ ⑥ Risk & SWOT ◀─ ⑤ Financials ◀─ ④ Business Plan
                                                            (InsForge benchmarks)
```

| # | Step | What happens | Tool |
| - | --- | --- | --- |
| 1 | **Validate** | Viability score (1–10), core problem, target market, concerns. A score < 5 triggers a frontend "continue anyway?" gate. | Gemini |
| 2 | **Market Research** | Market size, growth, competitors & weaknesses, the gap. **Grounded in InsForge** seed data + similar past plans. | Gemini + InsForge MCP |
| — | **⏸ Approval gate** | The agent **pauses** and streams an approval request. A human approves, rejects, or types a new strategic direction the agent must honor. | Human-in-the-loop |
| 3 | **Personas** | 3 customer personas (job, pain point, willingness to pay, acquisition channel). Honors any redirect. | Gemini |
| 4 | **Business Plan** | Problem, solution, UVP, revenue model & streams, go-to-market, milestones. | Gemini |
| 5 | **Financials** | 3-year revenue, startup cost, burn, break-even, funding — **kept realistic by InsForge benchmark averages**. | Gemini + InsForge MCP |
| 6 | **Risk & SWOT** | Ranked risks with mitigations + a full SWOT. | Gemini |
| 7 | **Finalize** | Generates a share token, seals the **tamper-evident audit chain**, persists everything to InsForge. | System + InsForge |

Each completed step is **streamed to the browser over SSE** so you watch the agent think in real time. InsForge Realtime then **pushes updates via WebSocket** to any other browser tab showing the same plan.

---

## Headline features

### 🦈 Shark Tank Simulator (investor pitch negotiation)
Every generated plan gets a **Shark Tank** tab powered by real business logic. Set your investment ask and equity %, instantly see your **implied company valuation**, then click "Step Into the Tank" to get reactions from **5 AI Sharks** with distinct personalities:

| Shark | Style | Focus |
|---|---|---|
| Mark C. | Tough skeptic | Traction data + unit economics |
| Sarah K. | Strategic | Defensible moats + brand |
| Raj P. | Tech-focused | AI scalability + recurring revenue |
| Lisa T. | Empathetic | Story + founding team |
| Carlos M. | Operational | Margins + supply chain |

Each shark delivers an **IN / COUNTER / OUT** verdict with a typed dialogue line, and counter-offers include the exact revised equity %. A summary header shows how many sharks are in and whether a deal is likely. The simulation is driven by your actual viability score, valuation multiple, and market data — not random numbers.

### 🔒 Tamper-evident audit chain (the trust layer)
Every step's output is hashed into a **SHA-256 chain** anchored to a genesis hash derived from the plan ID — each hash folds in the previous one (blockchain-style). If *any* stored field is later modified, re-verification **breaks at the exact step** and the UI flips from "✓ Chain verified" to "⚠ Chain broken." Endpoints `/api/plan/{id}/audit` and `/api/plan/{id}/verify` re-prove integrity on demand.

### ⏸ Human-in-the-loop approval gate
The agent doesn't run away with your idea. After market research it **pauses mid-stream**, keeps the connection warm with heartbeats, and waits for a decision — **approve**, **reject & stop**, or **redirect** ("focus on B2B enterprise"). The redirect is injected into the remaining steps. Set `SKIP_APPROVAL=true` to auto-approve after 3 s for demos/CI.

### 🤖 AI Chatbot with model selection
PitchCraft includes a floating AI assistant available on every page. Ask about your business idea, startup strategy, or how the platform works — the chatbot is powered by the same free model pool and lets you choose your preferred model on the fly:

| Model | Provider |
|---|---|
| Llama 3.3 70B | NVIDIA NIM (dedicated free) |
| Gemma 4 31B | OpenRouter (free) |
| Gemma 4 26B | OpenRouter (free) |
| GPT-OSS 120B | OpenRouter (free) |
| Qwen3 Next 80B | OpenRouter (free) |
| Llama 3.3 70B | OpenRouter (free) |

Select your model from a dropdown in the chat header. The chat history is preserved per session so you can keep the conversation going while exploring the platform.

### 🧠 Free model cascade (zero cost)
Pick a tier in the UI; the backend tries models in order:

1. **Gemini primary** (Google AI Studio free keys) — `gemini-3.5-flash` → `gemini-2.5-pro` → `gemini-2.5-flash` → `gemini-1.5-flash`. On quota/`429` PitchCraft rotates across your keys, then falls to the next tier.
2. **NVIDIA NIM** — `meta/llama-3.3-70b-instruct` — free dedicated endpoint, avoids OpenRouter shared-pool 429s.
3. **InsForge Model Gateway** — OpenRouter free models (`google/gemma-4-31b-it:free`, `openai/gpt-oss-120b:free`, `nvidia/nemotron-3-super-120b-a12b:free`, and 8+ more).

All three tiers are **$0**. The UI shows a badge when a fallback was used.

### 📡 InsForge Realtime — live plan updates
Every `UPDATE` on the `business_plans` table fires a Postgres trigger that publishes to the `plan:<id>` channel. The frontend subscribes with `@insforge/sdk` — a second browser tab watching the same plan updates in real time without polling.

### 👤 Authentication & plan history
InsForge Auth issues JWTs used for Row-Level Security. Logged-in users see their full plan history at `/history`. Row-level policies ensure users can only read their own plans. Anonymous generation still works (plans saved under `user_id = "anonymous"`).

### 🛡️ Admin dashboard (`/admin`)
A protected admin view showing all plans (with status filter), aggregated user stats, and the pending approval queue. Guarded by `ADMIN_SECRET` header.

### 📊 Arize Phoenix observability
Startup wires **OpenInference auto-instrumentation** for the `google-genai` SDK into Phoenix. Every Gemini call (prompt, model, tokens, latency) and every agent step appears as a span in your Phoenix project. Status is exposed at `/api/observability`. Fully optional — self-disables if no key is set, can never crash a run.

### 🗄️ InsForge as the agent's data layer — via MCP
InsForge Postgres stores plans, seeds 10 industries of market data, and holds the audit chains. The agent queries it through the **Model Context Protocol server** ([`backend/mcp_server.py`](backend/mcp_server.py)), which exposes three tools:

| MCP tool | What it grounds |
| --- | --- |
| `get_industry_market_data` | Step 2 — market size, growth, players, challenges |
| `search_similar_plans` | Step 2 — patterns from past plans in the same market |
| `get_market_benchmarks` | Step 5 — realistic financials from aggregated real plans |

The same server runs over **stdio** for any external MCP client (Claude Desktop, Cursor, MCP Inspector):

```bash
cd backend && python mcp_server.py          # stdio MCP server
```
```jsonc
// Claude Desktop / Cursor config
{ "mcpServers": { "pitchcraft-insforge": {
    "command": "python", "args": ["/abs/path/to/backend/mcp_server.py"] } } }
```

Inspect or invoke the tools over HTTP too: `GET /api/mcp/tools`, `GET /api/mcp/demo`, `POST /api/mcp/call`.

---

## Architecture

```
┌─────────────────────────────────┐         ┌──────────────────────────────────────────┐
│  Next.js 14 (frontend/)         │  SSE    │  FastAPI (backend/) on InsForge Compute   │
│  • model picker                 │ ──────▶ │  • /api/generate  → streams 7 steps       │
│  • live step cards              │ ◀────── │  • run_pitchcraft_agent (google-genai)    │
│  • approval gate modal          │         │  • approval + audit + MCP endpoints       │
│  • plan view + audit trail      │         └──────────────┬────────────────────────────┘
│  • /history (InsForge Auth)     │                        │
│  • /admin dashboard             │         ┌──────────────┼────────────────┐
│  @insforge/sdk (realtime sub)   │         ▼              ▼                ▼
└─────────────────────────────────┘   ┌──────────┐  ┌─────────────┐  ┌──────────────┐
                                      │ Gemini   │  │  InsForge   │  │ Arize        │
                                      │ + NIM    │  │  Postgres   │  │ Phoenix      │
                                      │ + OR GW  │  │  + Realtime │  │ (tracing)    │
                                      └──────────┘  └─────────────┘  └──────────────┘
```

**Backend** (`backend/`): `index.py` (FastAPI app & routes) · `agent.py` (the 7 ADK specialists + `PitchCraftOrchestra`) · `mcp_server.py` (the InsForge/MongoDB MCP server) · `insforge.py` (persistence, seed data, audit storage — replaces `mongodb.py`) · `audit.py` (SHA-256 chain) · `observability.py` (Arize Phoenix) · `models.py` (Pydantic schemas) · `Dockerfile` + `cloudbuild.yaml` + `insforge.toml` + `railway.toml`.

**Frontend** (`frontend/`): App-Router Next.js — `app/generate` (agent runner + gates), `app/plan/[id]` (plan + audit trail + Shark Tank simulator), `app/history` (per-user plan list), `app/admin` (admin dashboard), `app/auth` + `app/login` (InsForge Auth), `components/StepCard.tsx`, particle hero.

**Tech:** Gemini (`google-genai`) · **Google ADK** (`google-adk`: `LlmAgent` + `SequentialAgent`) · **InsForge** (`@insforge/sdk` frontend, REST API backend, AI Gateway) · NVIDIA NIM · InsForge Model Gateway (OpenRouter free models) · OpenAI SDK · Model Context Protocol (`mcp`) · Arize Phoenix (`arize-phoenix-otel` + `openinference-instrumentation-google-genai`) · FastAPI + SSE · Next.js 14 + Tailwind + Three.js.

---

## API reference

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/generate` | Start a run; streams 7 steps + the approval gate as SSE. |
| `GET` | `/api/plan/{id}` | Fetch a stored plan. |
| `GET` | `/api/plan/{id}/audit` | Audit chain + live verification result. |
| `POST` | `/api/plan/{id}/verify` | Re-verify the chain against stored data. |
| `GET` | `/api/approval/{id}` | Approval request status. |
| `POST` | `/api/approval/{id}/decide` | Record a reviewer decision (`approved`, optional `direction_override`). |
| `GET` | `/api/share/{token}` | Public read-only plan by share token. |
| `GET` | `/api/models` | Available model tiers (with `available` flag). |
| `GET` | `/api/agent/manifest` | **Full multi-agent architecture** — the 7 ADK specialists, their tools, the pipeline, InsForge & observability wiring. Built from live agent objects. |
| `GET` | `/api/agent/info` | Agent summary (ADK framework, model cascade, integrations). |
| `GET` | `/api/observability` | Arize Phoenix tracing status. |
| `GET`·`POST` | `/api/mcp/tools` · `/api/mcp/demo` · `/api/mcp/call` | Real MCP tool manifest, a live protocol demo, and direct tool invocation. |
| `GET` | `/api/admin/plans` | All plans (requires `ADMIN_SECRET` header). |
| `GET` | `/api/admin/users` | Aggregated user stats (requires `ADMIN_SECRET` header). |
| `GET`·`POST` | `/api/chat` | AI chatbot — `GET` returns available free models, `POST` sends a chat message. |
| `GET` | `/api/stats` · `/api/plans` · `/api/health` | Counts, recent plans, health. |

---

## Run it locally

**Prerequisites:** Node 18+, Python **3.12** (recommended), and at least one Gemini API key. InsForge and NVIDIA NIM are optional — the app degrades gracefully without them.

```bash
# 1. Configure secrets (copy and fill in values)
cp .env.example backend/.env
# Required: GEMINI_API_KEY_1
# Optional: INSFORGE_URL + INSFORGE_SERVICE_KEY (for persistence)
#           NVIDIA_NIM_API_KEY, OPENROUTER_API_KEY (for chatbot + fallback)

# Copy frontend env (fill in InsForge anon key if using auth)
cp .env.example frontend/.env.local

# 2. Backend  (terminal 1)
cd backend
python -m venv .venv && source .venv/Scripts/activate   # Windows; use bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn index:app --reload --port 8000

# 3. Frontend (terminal 2)
cd frontend
npm install
npm run dev          # http://localhost:3000  (proxies /api/* → :8000)
```

Open **http://localhost:3000/generate**, type an idea, pick a model, and watch the agent work. Set `SKIP_APPROVAL=true` in `.env` to auto-approve the gate during demos/CI.

> **Python version note:** `requirements.txt` is pinned for Python 3.12. On Python 3.13/3.14, prebuilt `pydantic-core` wheels may not yet exist. If so, use Python 3.12, or `pip install fastapi pydantic` (unpinned) to grab current wheels.

---

## Deploy

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full step-by-step guide. Quick summary:

### Option A — InsForge Compute + InsForge Sites (recommended, fully free)

```bash
# Link this directory to your InsForge project
npx @insforge/cli login
npx @insforge/cli link

# Add secrets (INSFORGE_URL, INSFORGE_SERVICE_KEY, OPENROUTER_API_KEY, etc.)
npx @insforge/cli secrets add INSFORGE_URL "https://YOUR-APP.us-east.insforge.app"
npx @insforge/cli secrets add INSFORGE_SERVICE_KEY "ik_..."
npx @insforge/cli secrets add OPENROUTER_API_KEY "sk-or-..."
npx @insforge/cli secrets add GEMINI_API_KEY_1 "AIzaSy..."

# Deploy FastAPI backend (builds remotely via Fly.io, no Docker needed locally)
npx @insforge/cli compute deploy backend/ --name pitchcraft-api

# Deploy Next.js frontend
npx @insforge/cli deployments deploy frontend/
```

### Option B — Google Cloud Run + Vercel

```bash
# Backend → Cloud Run
cd backend
gcloud run deploy pitchcraft-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "INSFORGE_URL=...,INSFORGE_SERVICE_KEY=...,OPENROUTER_API_KEY=...,GEMINI_API_KEY_1=...,SKIP_APPROVAL=true"
```

Then connect the frontend repo to Vercel and set `NEXT_PUBLIC_API_BASE` to the Cloud Run URL.

---

## Environment variables

### Backend (`backend/.env`)

| Var | Required | Purpose |
| --- | --- | --- |
| `INSFORGE_URL` | ✅ | InsForge project API base (e.g. `https://nb3y5334.us-east.insforge.app`). Without it the app runs in offline / no-persistence mode. |
| `INSFORGE_SERVICE_KEY` | ✅ | Admin key (`ik_...`) from InsForge dashboard or `.insforge/project.json`. |
| `OPENROUTER_API_KEY` | ✅ | Provisioned by `npx @insforge/cli ai setup`. Used as the free 3rd-tier fallback. |
| `INSFORGE_GATEWAY_MODEL` | – | Default free model for the InsForge gateway (default `google/gemma-4-31b-it:free`). |
| `NVIDIA_NIM_API_KEY` | – | Free Llama 3.3 70B — tried 2nd, before OpenRouter free models. |
| `GEMINI_API_KEY_1..3` | – | Google AI Studio free keys — primary reasoning path, rotated on quota. |
| `PHOENIX_API_KEY` | – | Enables Arize tracing. Must match endpoint (Cloud vs self-hosted). |
| `PHOENIX_COLLECTOR_ENDPOINT` | – | Phoenix collector URL (default `https://app.phoenix.arize.com`). |
| `PHOENIX_PROJECT` | – | Project name in Phoenix (default `pitchcraft`). |
| `APPROVAL_TIMEOUT_SECONDS` | – | How long the gate waits before abandoning (default 300). |
| `SKIP_APPROVAL` | – | `true` auto-approves the gate after 3 s. Default: `true`. |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW` | – | Per-IP `/api/generate` limit (default 3 req / 60 s). |
| `ADMIN_SECRET` | – | Protects `/api/admin/*` endpoints. |

### Frontend (`frontend/.env.local`)

| Var | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_INSFORGE_URL` | ✅ | Same as `INSFORGE_URL` — used by `@insforge/sdk` in the browser. |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | ✅ | Non-expiring public token (role `anon`). Generate: `curl -X POST "$INSFORGE_URL/api/auth/tokens/anon" -H "Authorization: Bearer $INSFORGE_SERVICE_KEY"` |
| `NEXT_PUBLIC_API_BASE` | – | Absolute backend URL for split deploys (Vercel + Cloud Run). Blank = same-origin / dev proxy. |
| `FRONTEND_URL` | – | Your deployed URL, for server-side Next.js fetches + CORS. |
| `OPENROUTER_API_KEY` | – | OpenRouter API key for the AI chatbot (server-side, `app/api/chat`). |
| `NVIDIA_NIM_API_KEY` | – | NVIDIA NIM API key for the Llama 3.3 70B chat model (server-side). |

---

## QA & verification status

- ✅ **Multi-agent ADK architecture.** Seven real `LlmAgent` specialists composed into a `SequentialAgent` pipeline; `/api/agent/manifest` returns all 7 with their tools. A full generation completes **7/7 steps** and the **SHA-256 audit chain verifies `True`**.
- ✅ **InsForge Postgres replaces MongoDB.** `insforge.py` is a drop-in replacement for `mongodb.py` — same public API, same graceful offline degradation. All CRUD, audit, and approval data now lives in InsForge.
- ✅ **InsForge Realtime wired.** Postgres trigger fires on every `UPDATE` to `business_plans`, publishing to the `plan:<id>` channel. Frontend `@insforge/sdk` subscribes and updates the UI without polling.
- ✅ **3-tier model cascade.** Gemini 3.5-flash → 2.5-pro → 2.5-flash → 1.5-flash → NVIDIA NIM → InsForge/OpenRouter free models. Any standard AI Studio key covers all four Gemini tiers.
- ✅ **`ThinkingConfig` guarded by model prefix** — 1.5-flash no longer breaks the guaranteed last-resort tier.
- ✅ **Approval gate wired end-to-end.** Full approve / reject / redirect modal in the frontend; InsForge `approval_requests` table with in-memory fallback when offline.
- ✅ **Audit Trail tab.** SHA-256 chain build → verify → tamper-detect, with a live timeline UI in the plan page.
- ✅ **Demo / offline fallback mode.** If the backend is unreachable for 60 s, the generate page replays a pre-built 7-step demo plan so judges always see a completed run.
- ✅ **Auth + History.** InsForge JWT auth gates the `/history` route; per-user plan lists load via `@insforge/sdk`.
- ✅ **Google OAuth & PKCE.** Fully integrated automatic OAuth code exchange and PKCE flow via the InsForge SDK, removing manual PKCE conflicts and stabilizing the login page.
- ✅ **Admin dashboard.** `/admin` shows all plans, user stats, and the pending approval queue — guarded by `ADMIN_SECRET`.
- ✅ **Arize Phoenix tracing** initializes, instruments `google-genai`, and emits spans — self-disables safely without a key.
- ✅ **CORS** fixed to match Vercel preview domains via regex.
- ✅ Backend HTTP smoke test (health/models/observability/mcp/stats/404/422) and frontend `tsc` + `eslint` all green.

---

## Roadmap

- **Atlas Vector Search / pgvector**: embed past plans for true semantic "similar plans" grounding (today uses indexed text/regex queries).
- **Phoenix evals**: add automated LLM-as-judge scoring of plan quality on top of the traces.
- **Real `/api/shark-tank` endpoint**: currently the shark simulation falls back gracefully client-side; next step is a Gemini-powered backend endpoint for fully dynamic shark dialogue.
- **Export**: one-click PDF / pitch-deck export (print-to-PDF exists today).
- **InsForge Edge Functions**: move the approval-gate logic to a serverless edge function so it works within Vercel's 60 s hobby limit.
- **Stripe payments** (InsForge Payments): gated premium tiers (more models, longer approval windows, team sharing).

---

## License

MIT — see [LICENSE](LICENSE).

<div align="center">
<sub>Built with Google ADK · Gemini · NVIDIA NIM · InsForge · OpenRouter · OpenAI SDK · Arize Phoenix — for the Google Cloud Rapid Agent Hackathon.</sub>
</div>
