-- ============================================================
-- Migration 012: App metadata (icon, lifetime rating, developer)
--
-- Feature 2.5 — capture and display the same metadata users see on
-- the actual store: app icon, developer name, lifetime average rating,
-- lifetime review count.
--
-- This data is populated from the onboarding store search (iTunes for
-- iOS, Play HTML scrape for Android) and refreshed weekly via cron.
--
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- ============================================================

ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS icon_url              TEXT,
  ADD COLUMN IF NOT EXISTS developer             TEXT,
  ADD COLUMN IF NOT EXISTS lifetime_rating       REAL,
  ADD COLUMN IF NOT EXISTS lifetime_review_count INTEGER,
  ADD COLUMN IF NOT EXISTS metadata_refreshed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.apps.icon_url IS
  'Public icon URL from the store (iTunes artwork or Play Store HTML).
   Display-only — never used for auth or fetching.';
COMMENT ON COLUMN public.apps.developer IS
  'Publisher / developer name shown on the store listing.';
COMMENT ON COLUMN public.apps.lifetime_rating IS
  'Public lifetime average rating from the store (matches what users see).
   Different from per-review averages computed from the synced window.';
COMMENT ON COLUMN public.apps.lifetime_review_count IS
  'Public lifetime review count from the store.';
COMMENT ON COLUMN public.apps.metadata_refreshed_at IS
  'Last time icon/rating/review count were refreshed from the store.';
