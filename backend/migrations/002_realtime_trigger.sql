-- 002_realtime_trigger.sql
-- When a plan row updates, broadcast the new step data to the plan's realtime
-- channel (plan:<id>) via InsForge's realtime.publish(). Any client subscribed
-- to that channel — e.g. the public share page on a second device — updates
-- live, with no SSE connection of its own.
--
-- realtime.publish(channel, event, payload) is the documented server-side
-- broadcast hook for InsForge Realtime; delivered messages carry senderType
-- 'system'. The frontend listens for the 'step_update' event.

CREATE OR REPLACE FUNCTION notify_plan_update()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM realtime.publish(
        'plan:' || NEW.id::text,
        'step_update',
        jsonb_build_object(
            'plan_id',         NEW.id,
            'status',          NEW.status,
            'validation',      NEW.validation,
            'market_research', NEW.market_research,
            'personas',        NEW.personas,
            'business_plan',   NEW.business_plan,
            'financials',      NEW.financials,
            'risks',           NEW.risks,
            'share_token',     NEW.share_token,
            'updated_at',      NEW.updated_at
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS plan_realtime_broadcast ON business_plans;
CREATE TRIGGER plan_realtime_broadcast
    AFTER UPDATE ON business_plans
    FOR EACH ROW EXECUTE FUNCTION notify_plan_update();
