# Information Architecture — categorization & de-vibe-code plan

**Date:** 2026-07-27 · **Trigger:** founder — "the features/screens/UI feel vibe-coded; move things around, categorise, fine-tune."
**Companions:** `docs/UX_AUDIT.md` (craft layer), `docs/ROLE_AUDIT.md` (access), `docs/DESIGN_SYSTEM_AUDIT.md` (tokens).

## Diagnosis

The screen inventory is right (UX audit agrees); what makes it feel vibe-coded
is that screens of **wildly different maturity are presented as equals**, plus
leftover theatre:

1. **Fabricated state shown as real** — Releases listed 4 invented versions
   with rollout bars; Automations seeded 3 sample rules that *never went away*
   for a zero-rule workspace (and toggling one fired the API with a fake id);
   Reply Kit "Tags" showed 18 invented tags while the rules engine actually
   applies 8.
2. **Dead controls** — 6 enabled buttons with no handler (Settings "Manage
   access", Releases "Pause rollout"/"New release", Automations header "Add
   rule", Tags "Import"/"Add tag" + a dead "Try it" link).
3. **Flat nav hierarchy** — the inbox (the product, per D018 Draft Mode) was
   buried mid-list as "Reviews" pointing at a redirect, while Dashboard sat
   alone on top.

## Every screen, categorized by what it actually is (post-phase-1)

| Screen | Data | Role in product | Verdict |
|---|---|---|---|
| **Inbox** | real | THE core loop | keep, first-class |
| **Dashboard** | real | daily health check | keep, first-class |
| Automations | real (now) | retention engine | keep |
| Reply Kit — Templates, KB, AI Styles | real | reply quality config | keep |
| Reply Kit — Tags | real vocabulary (now) | read-only reference | keep, small |
| Sentiment | real | weekly insight | keep |
| Releases | **real (now)** — grouped from synced reviews | release insight | keep |
| Incidents | real, thin usage | crash clusters | keep for now — see decision 2 |
| Reports | partial (send-now real, some cards "coming soon") | digest/export | keep |
| Competitors | real after migration 016 | benchmark | keep |
| ASO | real | growth | keep |
| Settings / Billing | real / gated by D013 | admin | keep |

## Phase 1 — shipped in this slice

1. **Releases rebuilt on real data.** The list now groups the workspace's
   synced reviews by `app_version`: reviews count, average rating, delta vs
   the previous version, first-seen date, linking to the (already-real)
   version detail page. Honest empty states for no-workspace / no-versioned-
   reviews (with the "N reviews synced without version info" nuance). The
   fabricated `releaseHealth` table, its component, and the two dead header
   buttons are deleted. No more invented rollout percentages — stores don't
   expose rollout, so we don't display it.
2. **Automations honest.** Rules start empty, real fetch replaces
   unconditionally, the existing empty state finally shows. Mock-rule seed
   removed (it also mis-fired the API with fake ids on toggle/delete).
3. **Tags tab shows the truth.** The 8-tag vocabulary the rules engine
   actually applies (crash, performance, release-regression, login,
   feature-request, support-delay, localization, billing), grouped by
   category, with the machine token visible. Dead Import/Add-tag/Try-it
   controls removed; copy now states what really happens ("auto-tagged on
   every sync, zero AI cost").
4. **Dead buttons removed** — Settings "Manage access" (role UI is backlog
   R3), Automations header "Add rule" (the hub has the real one).
5. **Nav categorized around the core loop** — ungrouped top: **Inbox** (with
   the real unreplied-count badge, previously keyed to a redirect route) +
   **Dashboard**; then **Automate** (Automations, Reply Kit), **Monitor**
   (Sentiment, Releases, Incidents, Reports), **Grow** (Competitors, ASO),
   Settings alone at the bottom. Group labels are verbs.

Left alone deliberately: AI Styles (real — persists `defaultTone` via the
workspace API; only its data file is misnamed `mock-`), AlertPreferences
(seeds a sensible default config; it's defaults, not fabrication — rename
`mockAlertPreferences` → `defaultAlertPreferences` someday), unused
`mockRules`/`mockTags` exports (dead data, no importer, cleanup-when-touched).

## Phase 2 — needs a founder verdict (nothing done)

1. **Merge Reply Kit into Automations?** One "Replies" hub: Rules · Templates
   · Knowledge Base · Tone · Tags. Two nav items become one; both screens are
   configuration for the same job. My lean: yes, at the next quiet moment.
2. **Incidents: keep as a screen or fold into Inbox?** Real data but thin —
   an incident is essentially a saved filter over crash reviews. Folding it
   into Inbox as an "Incidents" view would shrink nav by one. My lean: fold,
   after saved views (backlog X11) exist.
3. **Reports: keep the cards that say "coming soon"?** Honest but padding.
   My lean: keep only the two real send-now reports + CSV export until M3
   scheduling lands.
4. **Rename "ASO" → "Keywords"?** ASO is jargon to some indie devs. My lean:
   weak yes; cheap, do it whenever copy is next touched.

## Phase 3 — mechanical, queued behind the above

DS-003 gray→token sweep (~1,000 usages), DS-002 raw `<button>` → `<Button>`,
`mock-` file renames, empty-state pattern-8 cleanup on Reports.
