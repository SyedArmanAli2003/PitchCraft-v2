-- 001_initial.sql
-- PitchCraft initial schema on InsForge Postgres (replaces MongoDB Atlas).
--
-- Notes / corrections vs. the original migration draft:
--   * status allows 'abandoned' too — the agent sets that state when the
--     human-in-the-loop approval gate is rejected or times out.
--   * share_token is a nullable UNIQUE column (Postgres treats NULLs as
--     distinct, so multiple in-flight plans can coexist). The agent fills it
--     in at completion via secrets.token_urlsafe — this mirrors the old
--     Mongo behaviour and avoids the non-standard encode(...,'base64url').
--   * Extra columns (user_id, model, approval_id, approval_status,
--     audit_hashes, audit_chain_hash) back the fields the agent already
--     writes through update_plan(), so insforge.py is a true drop-in for
--     mongodb.py.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Business plans table (replaces MongoDB business_plans)
CREATE TABLE IF NOT EXISTS business_plans (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea             TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'generating'
                     CHECK (status IN ('generating','complete','failed','abandoned')),
    user_id          TEXT NOT NULL DEFAULT 'anonymous',
    share_token      TEXT UNIQUE,
    model            TEXT,
    model_used       TEXT,
    approval_id      TEXT,
    approval_status  TEXT,
    validation       JSONB DEFAULT '{}'::jsonb,
    market_research  JSONB DEFAULT '{}'::jsonb,
    personas         JSONB DEFAULT '[]'::jsonb,
    business_plan    JSONB DEFAULT '{}'::jsonb,
    financials       JSONB DEFAULT '{}'::jsonb,
    risks            JSONB DEFAULT '{}'::jsonb,
    audit_hashes     JSONB DEFAULT '{}'::jsonb,
    audit_chain_hash TEXT,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Audit chain table (replaces MongoDB audit_chains)
CREATE TABLE IF NOT EXISTS audit_chains (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id     UUID REFERENCES business_plans(id) ON DELETE CASCADE,
    chain       JSONB NOT NULL,
    final_hash  TEXT NOT NULL DEFAULT '',
    verified    BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Approval requests table (human-in-the-loop gate after step 2)
CREATE TABLE IF NOT EXISTS approval_requests (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id            UUID REFERENCES business_plans(id) ON DELETE CASCADE,
    status             TEXT DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','rejected')),
    step_data          JSONB,
    direction_override TEXT,
    created_at         TIMESTAMPTZ DEFAULT now(),
    decided_at         TIMESTAMPTZ
);

-- Market data (replaces MongoDB market_data collection)
CREATE TABLE IF NOT EXISTS market_data (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry    TEXT NOT NULL,
    market_size TEXT,
    growth_rate TEXT,
    key_players JSONB,
    avg_revenue TEXT,
    challenges  JSONB
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_plans_share_token ON business_plans(share_token);
CREATE INDEX IF NOT EXISTS idx_plans_status      ON business_plans(status);
CREATE INDEX IF NOT EXISTS idx_plans_created     ON business_plans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plans_user        ON business_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_plan        ON audit_chains(plan_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status  ON approval_requests(status);

-- Trigger to keep updated_at current automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plans_updated_at ON business_plans;
CREATE TRIGGER plans_updated_at
    BEFORE UPDATE ON business_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
