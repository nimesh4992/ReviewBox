-- ============================================================
-- 029 — Repair reviews stored as "replied" with no reply text
-- ============================================================
-- Follow-up to the code fix in PR #101. That change stopped NEW rows being
-- written this way; it could not repair rows already stored. This does.
--
-- THE BUG
--
-- App Store Connect's review list reports `relationships.response` — a reply
-- EXISTS — without carrying its body. The mapper trusted that flag, so a
-- review whose reply text we never fetched was stored as
-- `reply_status = 'replied', reply_text = null`. In the inbox that renders as
-- an answered review with nothing to show and an empty edit box, and because
-- sync never re-promotes or content-refreshes a known row, it never
-- self-heals. The fix (`include=response`) now fetches the body, and both the
-- mapper and `planSyncWrites()` refuse to mark a review replied without it.
--
-- THE REPAIR
--
-- Reset the affected rows to `needs_reply`. That is the state the fixed mapper
-- would have produced, and it is self-healing: the next sync sees the store's
-- developer reply, now WITH its text, and promotes the row properly.
--
-- ── Two populations, only one of them unambiguous ────────────────────────────
--
-- `reply_status = 'replied'` with blank text has two possible origins:
--
--   1. The bug. The sync promotion path always writes `replied_at` alongside
--      the text, so `replied_at IS NOT NULL` + blank text is a combination
--      only the bug produces. Section A repairs these automatically.
--
--   2. A deliberate user action. `POST /api/reviews/bulk-action` with
--      `mark_replied` (Draft Mode, D018 — the customer pasted their reply into
--      the store console themselves) sets `reply_status` and nothing else, so
--      it leaves `reply_text` and `replied_at` both null. That is the SAME
--      shape the insert path of the bug produced.
--
-- Section B therefore does NOT run automatically. Reverting a review the
-- customer explicitly marked as handled — putting it back in their unreplied
-- queue with no explanation — is worse than leaving a blank reply visible, so
-- that call is yours to make with the counts in front of you.
-- ============================================================

-- ── Section A — unambiguous, applied ─────────────────────────────────────────

do $$
declare
  repaired int;
begin
  update public.reviews
     set reply_status = 'needs_reply',
         reply_text   = null,
         replied_at   = null,
         updated_at   = now()
   where reply_status = 'replied'
     and replied_at is not null
     and (reply_text is null or btrim(reply_text) = '');

  get diagnostics repaired = row_count;
  raise notice '029: repaired % review(s) promoted to replied with no text', repaired;
end $$;

-- ── Section B — ambiguous, REVIEW BEFORE RUNNING ─────────────────────────────
--
-- Run this SELECT first. It splits the remaining blank-reply rows by the one
-- signal that separates them: a row written by the insert path has
-- `updated_at` equal to `created_at` (both set by the same statement), while a
-- row a user bulk-marked was updated later.
--
--   select
--     source,
--     case when updated_at = created_at
--          then 'likely sync bug'
--          else 'likely user marked as replied' end as origin,
--     count(*)
--   from public.reviews
--   where reply_status = 'replied'
--     and replied_at is null
--     and (reply_text is null or btrim(reply_text) = '')
--   group by 1, 2
--   order by 1, 2;
--
-- If the "likely user marked as replied" count is zero — i.e. nobody has ever
-- used the bulk "mark as replied" action — every remaining row is the bug and
-- the whole set is safe to reset:
--
--   update public.reviews
--      set reply_status = 'needs_reply',
--          reply_text   = null,
--          updated_at   = now()
--    where reply_status = 'replied'
--      and replied_at is null
--      and (reply_text is null or btrim(reply_text) = '');
--
-- If it is not zero, narrow to the rows that look like the bug by adding:
--
--      and updated_at = created_at
--      and source = 'app_store'
--
-- `updated_at = created_at` is a strong signal, not a guarantee. Prefer
-- leaving a row alone over reverting a customer's deliberate action: a blank
-- reply that stays visible is a cosmetic defect, whereas an unexplained
-- reappearance in the unreplied queue makes the product look like it lost
-- their work.

-- ── Verification ─────────────────────────────────────────────────────────────
--
--   select count(*) from public.reviews
--   where reply_status = 'replied'
--     and (reply_text is null or btrim(reply_text) = '');
--
-- After Section A this counts only the ambiguous population above. After
-- Section B (if you run it) it should be zero, and stay zero — the code fix
-- means nothing writes this shape any more.
