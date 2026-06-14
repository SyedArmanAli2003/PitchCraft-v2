# PitchCraft Deployment Guide

PitchCraft runs on **InsForge** — database, realtime, auth, model gateway, and
hosting all in one platform. The Free plan gives you 120 h/month of compute,
500 MB Postgres, 50 k MAU, and $1 in model credits, so the entire stack runs
at **$0**.

---

## Live deployment (InsForge Compute + InsForge Sites)

| Service | URL |
|---|---|
| **Frontend** | **https://nb3y5334.insforge.site** |
| **Backend API** | **https://pitchcraft-api-4cecea40-48ff-439f-a853-2b9029124c34.fly.dev** |
| Health check | https://pitchcraft-api-4cecea40-48ff-439f-a853-2b9029124c34.fly.dev/api/health |
| Agent manifest | https://pitchcraft-api-4cecea40-48ff-439f-a853-2b9029124c34.fly.dev/api/agent/manifest |
| InsForge Dashboard | https://insforge.dev/dashboard/project/4cecea40-48ff-439f-a853-2b9029124c34 |

---


```
Browser ──► Vercel (Next.js)  ──► InsForge Compute/Fly.io (FastAPI)
                                         │
                              InsForge Postgres  (business_plans, audit_chains, …)
                              InsForge Realtime  (live plan:* channel)
                              InsForge Model GW  (OpenRouter free models)
                              NVIDIA NIM         (Llama 3.3 70B, free dedicated)
                              Gemini (Google AI Studio, free tier)
```

---

## OPTION A — InsForge Compute + Vercel (recommended, fully free)

### Prerequisites
```bash
npx @insforge/cli login          # sign in once
npx @insforge/cli link           # link this directory to the pitchcraft project
```

### Step 1 — Set backend secrets
```bash
# First time — create secrets (use 'update' instead of 'add' to overwrite existing)
npx @insforge/cli secrets add INSFORGE_URL        "https://nb3y5334.us-east.insforge.app"
npx @insforge/cli secrets add INSFORGE_SERVICE_KEY "ik_..."
npx @insforge/cli secrets add OPENROUTER_API_KEY  "sk-or-..."
npx @insforge/cli secrets add NVIDIA_NIM_API_KEY  "nvapi-..."
npx @insforge/cli secrets add GEMINI_API_KEY_1    "AIzaSy..."  # optional
npx @insforge/cli secrets add INSFORGE_GATEWAY_MODEL "google/gemma-4-31b-it:free"
npx @insforge/cli secrets add SKIP_APPROVAL       "true"
npx @insforge/cli secrets add APPROVAL_TIMEOUT_SECONDS "300"
npx @insforge/cli secrets add RATE_LIMIT_MAX      "3"
npx @insforge/cli secrets add RATE_LIMIT_WINDOW   "60"

# Note: ANON_KEY, JWT_SECRET, INSFORGE_BASE_URL, API_KEY are reserved and
# managed automatically by InsForge — do not add them manually.

# List all secrets (values hidden):
npx @insforge/cli secrets list

# Update an existing secret:
npx @insforge/cli secrets update GEMINI_API_KEY_1 --value "AIzaSy..."
```

### Step 2 — Deploy the FastAPI backend
```bash
# Source-mode deploy (builds remotely via flyctl, no Docker needed locally):
npx @insforge/cli compute deploy backend/ --name pitchcraft-api

# Or image-mode if you already have a built image:
npx @insforge/cli compute deploy --image ghcr.io/youruser/pitchcraft-api:latest --name pitchcraft-api
```

The deploy command returns a URL like `https://pitchcraft-api.fly.dev`.

### Step 3 — Deploy the Next.js frontend (Vercel via InsForge)
```bash
npx @insforge/cli deployments deploy frontend/
```

Or connect the repo directly in Vercel and set:
```
NEXT_PUBLIC_INSFORGE_URL    = https://nb3y5334.us-east.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY = eyJ...  (from POST /api/auth/tokens/anon)
NEXT_PUBLIC_API_BASE        = https://pitchcraft-api.fly.dev
```

### Free plan limits to watch
| Resource | Free allowance |
|---|---|
| Compute | 120 h/month (restarts after 1 week inactivity) |
| Database | 500 MB Postgres |
| Model Gateway | $1 AI credits/month |
| Bandwidth | 5 GB/month |

---

## OPTION B — Google Cloud Run (if you prefer GCP)

### Backend → Cloud Run
```bash
cd backend
gcloud run deploy pitchcraft-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "INSFORGE_URL=...,INSFORGE_SERVICE_KEY=...,OPENROUTER_API_KEY=...,NVIDIA_NIM_API_KEY=...,SKIP_APPROVAL=true"
```

### Frontend → Vercel
Same as Option A Step 3, but set `NEXT_PUBLIC_API_BASE` to the Cloud Run URL.

---

## Environment variables reference

### Backend (`backend/.env`)
| Variable | Required | Notes |
|---|---|---|
| `INSFORGE_URL` | ✅ | `https://nb3y5334.us-east.insforge.app` |
| `INSFORGE_SERVICE_KEY` | ✅ | Admin key (`ik_...`) from InsForge dashboard |
| `OPENROUTER_API_KEY` | ✅ | Provisioned by `npx @insforge/cli ai setup` |
| `INSFORGE_GATEWAY_MODEL` | optional | Default: `google/gemma-4-31b-it:free` |
| `NVIDIA_NIM_API_KEY` | optional | Free Llama 3.3 70B — tried first in free cascade |
| `GEMINI_API_KEY_1..3` | optional | Google AI Studio free keys — primary reasoning |
| `SKIP_APPROVAL` | optional | `true` for demos (auto-approves after 3 s) |
| `ADMIN_SECRET` | optional | Protects `/api/admin/*` endpoints |

### Frontend (`frontend/.env.local`)
| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_INSFORGE_URL` | ✅ | Same as `INSFORGE_URL` |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | ✅ | From `POST /api/auth/tokens/anon` |
| `NEXT_PUBLIC_API_BASE` | ✅ (split deploy) | Backend URL; leave blank for monorepo |

---

## Local development

```bash
# Terminal 1 — backend
cd backend
pip install -r requirements.txt
uvicorn index:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api/*` → `http://localhost:8000` automatically.

---

## Free model cascade (generation priority)

1. **Gemini primary** (Google AI Studio free keys — `GEMINI_API_KEY_1..3`)
   - gemini-3.5-flash → gemini-3.1-flash-lite → gemini-2.5-flash-lite → …
2. **NVIDIA NIM** (`NVIDIA_NIM_API_KEY`) — meta/llama-3.3-70b-instruct (dedicated free endpoint)
3. **InsForge Model Gateway** (`OPENROUTER_API_KEY`) — rotates across:
   - `google/gemma-4-31b-it:free`
   - `google/gemma-4-26b-a4b-it:free`
   - `openai/gpt-oss-120b:free`
   - `nvidia/nemotron-3-super-120b-a12b:free`
   - `nvidia/nemotron-3-ultra-550b-a55b:free`
   - `qwen/qwen3-next-80b-a3b-instruct:free`
   - `meta-llama/llama-3.3-70b-instruct:free`
   - … (8 more free models)

All three tiers are $0. Gemini is the most reliable for JSON; NVIDIA NIM is a
dedicated endpoint so it avoids the shared-pool 429 storms on OpenRouter.
