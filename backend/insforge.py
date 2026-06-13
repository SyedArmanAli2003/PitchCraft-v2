"""InsForge data layer for PitchCraft — drop-in replacement for mongodb.py.

This talks to InsForge's PostgreSQL via its PostgREST-style REST API
(`/api/database/records/{table}`) using the project service key. It exposes the
exact same public functions (same names + signatures) that the old `mongodb.py`
did, so `agent.py` / `index.py` / `mcp_server.py` only need to swap the import.

Why REST and not a Postgres driver: it keeps the backend dependency-light
(httpx only), works the same locally and on serverless, and is the canonical
InsForge access path. Every table created in InsForge is automatically a REST
endpoint.

Realtime: a Postgres trigger (migrations/002_realtime_trigger.sql) calls
`realtime.publish('plan:<id>', 'step_update', ...)` on every UPDATE, so the
frontend gets live updates over WebSockets without any extra work here — each
`update_plan()` call automatically broadcasts.

If InsForge is not configured (no URL/key), every function degrades gracefully
(the "no-db" sentinel + no-ops), exactly like the old Mongo layer, so local
demos and the offline replay still run.
"""

import os
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

import httpx
from dotenv import load_dotenv

load_dotenv()

INSFORGE_URL = (os.getenv("INSFORGE_URL", "") or "").strip().rstrip("/")
INSFORGE_SERVICE_KEY = (os.getenv("INSFORGE_SERVICE_KEY", "") or "").strip()

_REST = f"{INSFORGE_URL}/api/database/records" if INSFORGE_URL else ""

_HEADERS = {
    "Authorization": f"Bearer {INSFORGE_SERVICE_KEY}",
    "Content-Type": "application/json",
}

# Columns on business_plans that are plain scalars / JSONB columns (everything
# the agent writes through update_plan). Dotted paths like "audit_hashes.step_1"
# are merged into the audit_hashes JSONB column (see update_plan).
_PLAN_COLUMNS = {
    "idea", "status", "user_id", "share_token", "model", "model_used",
    "approval_id", "approval_status", "validation", "market_research",
    "personas", "business_plan", "financials", "risks", "audit_hashes",
    "audit_chain_hash",
}


def _configured() -> bool:
    return bool(INSFORGE_URL and INSFORGE_SERVICE_KEY)


def insforge_ready() -> bool:
    """True when the InsForge backend is configured (URL + service key)."""
    return _configured()


def _client() -> httpx.Client:
    return httpx.Client(base_url=_REST, headers=_HEADERS, timeout=30.0)


# ---------------------------------------------------------------------------
# Compatibility shim: index.py imports `_get_db` and checks `is not None`.
# Returns a truthy sentinel when InsForge is reachable-configured, else None.
# ---------------------------------------------------------------------------

def _get_db():
    return _REST if _configured() else None


def _with_id(row: Optional[dict]) -> Optional[dict]:
    """Add a Mongo-style `_id` alias so existing callers (index.py / frontend
    BusinessPlan type) that read `_id` keep working unchanged."""
    if isinstance(row, dict) and "id" in row and "_id" not in row:
        row["_id"] = row["id"]
    return row


# ---------------------------------------------------------------------------
# Seed market data (mirrors the old Mongo seed; used as a guaranteed fallback)
# ---------------------------------------------------------------------------

SEED_MARKET_DATA = [
    {"industry": "Technology", "market_size": "$5.3 trillion globally (2024)", "growth_rate": "8% CAGR",
     "key_players": ["Apple", "Microsoft", "Google", "Amazon", "NVIDIA"], "avg_revenue": "$50M for mid-stage startups",
     "challenges": ["Rapid obsolescence", "High talent costs", "Intense competition", "Security and privacy compliance"]},
    {"industry": "Healthcare", "market_size": "$12 trillion globally", "growth_rate": "9% CAGR",
     "key_players": ["UnitedHealth", "Johnson & Johnson", "Pfizer", "Roche"], "avg_revenue": "$30M for mid-stage startups",
     "challenges": ["Strict regulation (FDA/HIPAA)", "Long sales cycles", "Reimbursement complexity", "Clinical validation costs"]},
    {"industry": "Education", "market_size": "$7 trillion globally", "growth_rate": "10% CAGR (EdTech)",
     "key_players": ["Coursera", "Duolingo", "Chegg", "Byju's", "Khan Academy"], "avg_revenue": "$15M for mid-stage startups",
     "challenges": ["Low willingness to pay", "High churn", "Slow institutional adoption", "Measuring learning outcomes"]},
    {"industry": "Food & Beverage", "market_size": "$8 trillion globally", "growth_rate": "6% CAGR",
     "key_players": ["Nestle", "PepsiCo", "Coca-Cola", "Unilever", "DoorDash"], "avg_revenue": "$20M for mid-stage startups",
     "challenges": ["Thin margins", "Perishability and logistics", "Food safety regulation", "Brand differentiation"]},
    {"industry": "E-commerce", "market_size": "$6.3 trillion globally", "growth_rate": "11% CAGR",
     "key_players": ["Amazon", "Alibaba", "Shopify", "eBay", "Walmart"], "avg_revenue": "$25M for mid-stage startups",
     "challenges": ["Customer acquisition cost", "Logistics and fulfillment", "Razor-thin margins", "Platform dependency"]},
    {"industry": "Finance", "market_size": "$26 trillion globally", "growth_rate": "7% CAGR (FinTech)",
     "key_players": ["JPMorgan", "Visa", "Stripe", "PayPal", "Mastercard"], "avg_revenue": "$40M for mid-stage startups",
     "challenges": ["Heavy regulation and licensing", "Trust and security", "Fraud risk", "Incumbent competition"]},
    {"industry": "Real Estate", "market_size": "$3.7 trillion (PropTech adjacent)", "growth_rate": "5% CAGR",
     "key_players": ["Zillow", "CBRE", "Compass", "Opendoor", "Redfin"], "avg_revenue": "$22M for mid-stage startups",
     "challenges": ["High capital intensity", "Market cyclicality", "Fragmented data", "Long transaction cycles"]},
    {"industry": "Transportation", "market_size": "$7 trillion globally", "growth_rate": "6% CAGR",
     "key_players": ["Uber", "Tesla", "FedEx", "Maersk", "Lyft"], "avg_revenue": "$28M for mid-stage startups",
     "challenges": ["Capital and infrastructure costs", "Regulatory hurdles", "Unit economics", "Safety and liability"]},
    {"industry": "Entertainment", "market_size": "$2.8 trillion globally", "growth_rate": "8% CAGR",
     "key_players": ["Netflix", "Disney", "Spotify", "Sony", "Tencent"], "avg_revenue": "$18M for mid-stage startups",
     "challenges": ["Content costs", "Attention competition", "Monetization and churn", "Rights and licensing"]},
    {"industry": "Agriculture", "market_size": "$12 trillion globally", "growth_rate": "7% CAGR (AgTech)",
     "key_players": ["John Deere", "Bayer", "Cargill", "Corteva", "Indigo Ag"], "avg_revenue": "$16M for mid-stage startups",
     "challenges": ["Long adoption cycles", "Weather and climate risk", "Fragmented buyers", "Capital intensity"]},
]


def seed_market_data() -> None:
    """Seed the InsForge market_data table once, if it's empty."""
    if not _configured():
        return
    try:
        with _client() as c:
            r = c.get("/market_data", params={"select": "id", "limit": 1})
            r.raise_for_status()
            if r.json():
                return  # already seeded
            c.post("/market_data", json=SEED_MARKET_DATA,
                   headers={"Prefer": "return=minimal"}).raise_for_status()
    except Exception as exc:
        print(f"⚠️  market_data seed skipped: {exc}")


def init_db() -> None:
    if not _configured():
        print("⚠️  InsForge not configured — running without persistence.")
        return
    try:
        with _client() as c:
            c.get("/business_plans", params={"select": "id", "limit": 1}).raise_for_status()
        seed_market_data()
        print("✅ InsForge connected and ready")
    except Exception as exc:
        print(f"❌ InsForge init error: {exc}")


# ---------------------------------------------------------------------------
# business_plans
# ---------------------------------------------------------------------------

def save_plan(idea: str, user_id: str | None = None) -> str:
    if not _configured():
        return "no-db"
    try:
        with _client() as c:
            r = c.post(
                "/business_plans",
                json=[{"idea": idea, "status": "generating", "user_id": user_id or "anonymous"}],
                headers={"Prefer": "return=representation"},
            )
            r.raise_for_status()
            return r.json()[0]["id"]
    except Exception as exc:
        print(f"⚠️  save_plan failed: {exc}")
        return "no-db"


def update_plan(plan_id: str, field: str, data) -> None:
    if plan_id == "no-db" or not _configured():
        return
    try:
        # Dotted path (e.g. "audit_hashes.step_1") -> merge into a JSONB column.
        if "." in field:
            col, _, key = field.partition(".")
            _merge_jsonb_key(plan_id, col, key, data)
            return
        if field not in _PLAN_COLUMNS:
            # Unknown field — best effort, skip silently (parity with old layer
            # which simply set arbitrary keys on a schemaless Mongo doc).
            return
        with _client() as c:
            c.patch(
                f"/business_plans?id=eq.{quote(plan_id)}",
                json={field: data},
                headers={"Prefer": "return=minimal"},
            ).raise_for_status()
    except Exception as exc:
        print(f"⚠️  update_plan({field}) failed: {exc}")


def _merge_jsonb_key(plan_id: str, column: str, key: str, value) -> None:
    """Read-merge-write a single key into a JSONB column (used for the
    per-step audit_hashes map). Best-effort; never raises."""
    if column not in _PLAN_COLUMNS:
        return
    try:
        with _client() as c:
            r = c.get(f"/business_plans?id=eq.{quote(plan_id)}&select={column}&limit=1")
            r.raise_for_status()
            rows = r.json()
            current = (rows[0].get(column) if rows else None) or {}
            if not isinstance(current, dict):
                current = {}
            current[key] = value
            c.patch(
                f"/business_plans?id=eq.{quote(plan_id)}",
                json={column: current},
                headers={"Prefer": "return=minimal"},
            ).raise_for_status()
    except Exception as exc:
        print(f"⚠️  jsonb merge {column}.{key} failed: {exc}")


def get_plan(plan_id: str) -> dict | None:
    if plan_id == "no-db" or not _configured():
        return None
    try:
        with _client() as c:
            r = c.get(f"/business_plans?id=eq.{quote(plan_id)}&limit=1")
            r.raise_for_status()
            data = r.json()
            return _with_id(data[0]) if data else None
    except Exception:
        return None


def get_plan_by_token(token: str) -> dict | None:
    if not _configured():
        return None
    try:
        with _client() as c:
            r = c.get(f"/business_plans?share_token=eq.{quote(token)}&limit=1")
            r.raise_for_status()
            data = r.json()
            return _with_id(data[0]) if data else None
    except Exception:
        return None


def _count(params: dict) -> int:
    """Count business_plans rows matching params. Tries the X-Total-Count
    header first, else falls back to len() of the id list (capped)."""
    if not _configured():
        return 0
    try:
        with _client() as c:
            p = {"select": "id", "limit": 1000, **params}
            r = c.get("/business_plans", params=p, headers={"Prefer": "count=exact"})
            r.raise_for_status()
            total = r.headers.get("X-Total-Count")
            if total is not None and total.isdigit():
                return int(total)
            return len(r.json())
    except Exception:
        return 0


def get_plan_count() -> int:
    return _count({})


def get_plans_today() -> int:
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return _count({"created_at": f"gte.{start.isoformat()}"})


def get_recent_plans(limit: int = 50, user_id: str | None = None) -> list[dict]:
    if not _configured():
        return []
    try:
        params = {"status": "eq.complete", "order": "created_at.desc", "limit": limit}
        if user_id and user_id != "anonymous":
            params["user_id"] = f"eq.{user_id}"
        with _client() as c:
            r = c.get("/business_plans", params=params)
            r.raise_for_status()
            docs = r.json()
        for d in docs:
            _with_id(d)
            d.pop("user_id", None)  # don't expose internal user_id to regular users
        return docs
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Admin functions
# ---------------------------------------------------------------------------

def get_all_plans_admin(limit: int = 100, status: str | None = None) -> list[dict]:
    if not _configured():
        return []
    try:
        params = {"order": "created_at.desc", "limit": limit}
        if status:
            params["status"] = f"eq.{status}"
        with _client() as c:
            r = c.get("/business_plans", params=params)
            r.raise_for_status()
            docs = r.json()
        for d in docs:
            _with_id(d)
        return docs
    except Exception:
        return []


def get_user_stats() -> list[dict]:
    """Aggregate plan counts grouped by user_id. PostgREST has no GROUP BY over
    the records endpoint, so we aggregate client-side over recent plans."""
    if not _configured():
        return []
    try:
        with _client() as c:
            r = c.get("/business_plans", params={
                "select": "user_id,status,created_at",
                "order": "created_at.desc",
                "limit": 1000,
            })
            r.raise_for_status()
            rows = r.json()
        agg: dict[str, dict] = {}
        for row in rows:
            uid = row.get("user_id") or "anonymous"
            a = agg.setdefault(uid, {"user_id": uid, "total_plans": 0, "complete_plans": 0, "last_active": None})
            a["total_plans"] += 1
            if row.get("status") == "complete":
                a["complete_plans"] += 1
            ca = row.get("created_at")
            if ca and (a["last_active"] is None or ca > a["last_active"]):
                a["last_active"] = ca
        return sorted(agg.values(), key=lambda x: x["total_plans"], reverse=True)[:100]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# market_data
# ---------------------------------------------------------------------------

def _search_static(keyword: str) -> dict:
    k = (keyword or "").lower()
    for row in SEED_MARKET_DATA:
        industry = row["industry"].lower()
        tokens = re.split(r"[^a-z]+", industry)
        if industry in k or any(t and t in k for t in tokens):
            return dict(row)
    return dict(SEED_MARKET_DATA[0])


def search_market_data(industry_keyword: str) -> dict:
    keyword = (industry_keyword or "").strip()
    lowered = keyword.lower()
    if not _configured():
        return _search_static(lowered)
    try:
        with _client() as c:
            if keyword:
                r = c.get("/market_data", params={"industry": f"ilike.{keyword}", "limit": 1})
                r.raise_for_status()
                exact = r.json()
                if exact:
                    return _clean(exact[0])
                r = c.get("/market_data", params={"limit": 100})
                r.raise_for_status()
                for row in r.json():
                    industry = (row.get("industry") or "").lower()
                    tokens = re.split(r"[^a-z]+", industry)
                    if industry in lowered or any(t and t in lowered for t in tokens):
                        return _clean(row)
            r = c.get("/market_data", params={"industry": "eq.Technology", "limit": 1})
            r.raise_for_status()
            fallback = r.json()
            return _clean(fallback[0]) if fallback else _search_static(lowered)
    except Exception:
        return _search_static(lowered)


def _clean(doc: dict) -> dict:
    doc = dict(doc)
    doc.pop("_id", None)
    doc.pop("id", None)
    return doc


# ---------------------------------------------------------------------------
# audit_chains
# ---------------------------------------------------------------------------

def save_audit_chain(plan_id: str, chain: list[dict]) -> None:
    """Persist the full audit chain for a plan (one row per plan)."""
    if plan_id == "no-db" or not _configured():
        return
    final_hash = ""
    if chain and isinstance(chain[-1], dict):
        final_hash = chain[-1].get("hash", "") or ""
    try:
        with _client() as c:
            # Replace any prior chain for idempotency on re-runs.
            try:
                c.delete(f"/audit_chains?plan_id=eq.{quote(plan_id)}",
                         headers={"Prefer": "return=minimal"})
            except Exception:
                pass
            c.post(
                "/audit_chains",
                json=[{"plan_id": plan_id, "chain": chain, "final_hash": final_hash, "verified": True}],
                headers={"Prefer": "return=minimal"},
            ).raise_for_status()
    except Exception as exc:
        print(f"⚠️  save_audit_chain failed: {exc}")


def get_audit_chain(plan_id: str) -> dict | None:
    """Return {plan_id, chain, generated_at, final_hash, verified}."""
    if plan_id == "no-db" or not _configured():
        return None
    try:
        with _client() as c:
            r = c.get(f"/audit_chains?plan_id=eq.{quote(plan_id)}&order=created_at.desc&limit=1")
            r.raise_for_status()
            data = r.json()
        if not data:
            return None
        doc = data[0]
        _with_id(doc)
        # `generated_at` alias kept for index.py compatibility.
        doc["generated_at"] = doc.get("created_at")
        return doc
    except Exception:
        return None


# ---------------------------------------------------------------------------
# approval_requests (human-in-the-loop). The row's UUID `id` IS the approval_id.
# ---------------------------------------------------------------------------
# In-memory fallback so the gate still works with no InsForge configured.
_MEMORY_APPROVALS: dict[str, dict] = {}


def _approval_with_alias(row: dict) -> dict:
    if isinstance(row, dict) and "id" in row:
        row["approval_id"] = row["id"]
        row["_id"] = row["id"]
    return row


def create_approval_request(plan_id: str, step_data: dict) -> str:
    if not _configured():
        import uuid
        approval_id = str(uuid.uuid4())
        _MEMORY_APPROVALS[approval_id] = {
            "approval_id": approval_id, "plan_id": plan_id, "status": "pending",
            "step_data": step_data, "direction_override": None,
            "created_at": datetime.now(timezone.utc).isoformat(), "decided_at": None,
        }
        return approval_id
    try:
        with _client() as c:
            r = c.post(
                "/approval_requests",
                json=[{"plan_id": plan_id, "step_data": step_data, "status": "pending"}],
                headers={"Prefer": "return=representation"},
            )
            r.raise_for_status()
            return r.json()[0]["id"]
    except Exception as exc:
        print(f"⚠️  create_approval_request failed, using memory: {exc}")
        import uuid
        approval_id = str(uuid.uuid4())
        _MEMORY_APPROVALS[approval_id] = {
            "approval_id": approval_id, "plan_id": plan_id, "status": "pending",
            "step_data": step_data, "direction_override": None,
            "created_at": datetime.now(timezone.utc).isoformat(), "decided_at": None,
        }
        return approval_id


def get_approval_request(approval_id: str) -> dict | None:
    if _configured():
        try:
            with _client() as c:
                r = c.get(f"/approval_requests?id=eq.{quote(approval_id)}&limit=1")
                r.raise_for_status()
                data = r.json()
            if data:
                return _approval_with_alias(data[0])
        except Exception:
            pass
    mem = _MEMORY_APPROVALS.get(approval_id)
    return dict(mem) if mem else None


def list_approval_requests(status: str | None = None) -> list[dict]:
    if _configured():
        try:
            params = {"order": "created_at.desc", "limit": 100}
            if status:
                params["status"] = f"eq.{status}"
            with _client() as c:
                r = c.get("/approval_requests", params=params)
                r.raise_for_status()
                return [_approval_with_alias(d) for d in r.json()]
        except Exception:
            pass
    results = []
    for d in list(_MEMORY_APPROVALS.values()):
        if status is None or d.get("status") == status:
            results.append(dict(d))
    return results


def resolve_approval(approval_id: str, approved: bool, direction_override: str | None) -> bool:
    status = "approved" if approved else "rejected"
    update = {
        "status": status,
        "decided_at": datetime.now(timezone.utc).isoformat(),
        "direction_override": direction_override,
    }
    if _configured():
        try:
            with _client() as c:
                r = c.patch(
                    f"/approval_requests?id=eq.{quote(approval_id)}",
                    json=update,
                    headers={"Prefer": "return=representation"},
                )
                r.raise_for_status()
                if r.json():
                    return True
        except Exception as exc:
            print(f"⚠️  resolve_approval failed: {exc}")
    mem = _MEMORY_APPROVALS.get(approval_id)
    if mem is not None:
        mem.update(update)
        return True
    return False


# ---------------------------------------------------------------------------
# MCP tool backends (grounding for the Market & Finance agents)
# ---------------------------------------------------------------------------

def mcp_search_similar_plans(industry: str) -> dict:
    if not _configured():
        return {"tool": "search_similar_plans", "results": [], "count": 0}
    try:
        with _client() as c:
            r = c.get("/business_plans", params={
                "status": "eq.complete",
                "validation->>target_market": f"ilike.*{industry}*",
                "select": "id,market_research,financials,validation",
                "limit": 3,
            })
            r.raise_for_status()
            plans = r.json()
        for p in plans:
            _with_id(p)
        return {"tool": "search_similar_plans", "results": plans, "count": len(plans)}
    except Exception:
        return {"tool": "search_similar_plans", "results": [], "count": 0}


def mcp_get_market_benchmarks(industry: str) -> dict:
    """Aggregate benchmarks from completed plans in InsForge, blended with the
    seed industry data — grounds the financial step."""
    market = search_market_data(industry)
    viability_scores: list[float] = []
    break_even_months: list[int] = []
    plans_analyzed = 0

    if _configured():
        try:
            with _client() as c:
                r = c.get("/business_plans", params={
                    "status": "eq.complete",
                    "select": "validation,financials",
                    "order": "created_at.desc",
                    "limit": 50,
                })
                r.raise_for_status()
                for p in r.json():
                    plans_analyzed += 1
                    score = (p.get("validation") or {}).get("viability_score")
                    if isinstance(score, (int, float)):
                        viability_scores.append(float(score))
                    be = (p.get("financials") or {}).get("break_even_month")
                    if isinstance(be, (int, float)):
                        break_even_months.append(int(be))
        except Exception:
            pass

    def _avg(xs):
        return round(sum(xs) / len(xs), 1) if xs else None

    return {
        "tool": "get_market_benchmarks",
        "industry_data": market,
        "plans_analyzed": plans_analyzed,
        "avg_viability_score": _avg(viability_scores),
        "avg_break_even_month": _avg(break_even_months),
        "note": "Grounded in real plans stored in InsForge Postgres",
    }


def mcp_get_tools_manifest() -> list:
    return [
        {"name": "search_similar_plans", "description": "Search stored business plans by industry", "input_schema": {"industry": "string"}},
        {"name": "get_market_benchmarks", "description": "Get aggregated financial benchmarks", "input_schema": {"industry": "string"}},
        {"name": "store_plan", "description": "Store a completed business plan", "input_schema": {"plan_id": "string"}},
    ]
