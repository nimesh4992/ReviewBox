-- ============================================================
-- 026 — Drop the superseded alert_preferences columns
-- ============================================================
-- OPTIONAL / HOUSEKEEPING. Nothing breaks if this is never run.
--
-- alert_preferences currently carries two parallel, incompatible shapes:
--
--   from 001 (superseded, read by nothing):
--     channel_email boolean, channel_slack boolean,
--     schedule_dow smallint, schedule_dom smallint
--
--   from 020 (what the code actually reads and writes):
--     channels jsonb, schedule_day_of_week, schedule_day_of_month,
--     label, description
--
-- A repo-wide grep confirms zero references anywhere in src/ to the four
-- columns dropped below.
--
-- Why bother, given nothing reads them: this codebase is maintained primarily
-- by AI agents that read the migrations as ground truth, and the DEAD columns
-- look more authoritative than the live ones — typed booleans and smallints
-- with defaults, versus a permissive jsonb blob. That is an invitation for a
-- future agent to build the next alerts feature against the shape that was
-- abandoned. Removing them makes the schema say what it means.
--
-- Run it when convenient. If any external consumer (a saved SQL query, a BI
-- tool, an export) reads these columns, skip it — the app does not care.
-- ============================================================

alter table public.alert_preferences drop column if exists channel_email;
alter table public.alert_preferences drop column if exists channel_slack;
alter table public.alert_preferences drop column if exists schedule_dow;
alter table public.alert_preferences drop column if exists schedule_dom;
