# ReviewBox — App UX Audit

**Date:** 2026-07-26 · **Method:** all 12 authenticated screens rendered locally
(Chromium via Playwright, API fixtures, middleware bypassed) plus 8 production
screenshots supplied by the founder. Token-level measurements are in
`docs/DESIGN_SYSTEM_AUDIT.md` and the 2026-07-26 commits.

## Verdict

The **structure** is right: the navigation, screen inventory, and information
architecture already cover most of what an AppFollow-class product offers. What
reads as "AI-generated" is the **craft layer** — and it is specific, not vague.
Eight recurring patterns, each with named locations:

| # | Pattern | Where seen | Status |
|---|---------|-----------|--------|
| 1 | **Promo banners inside work screens** — solid-indigo "Smarter tags, powered by AI" panel above the tags table; lavender "AI is preparing your workspace"; blue "link account" bar + amber sync warning stacking three banners on the dashboard | Reply Kit, Dashboard | Tags banner → one-line muted hint ✅. Dashboard banner consolidation **open** |
| 2 | **Auto-opening modal** — Google Play setup modal opens itself over the dashboard on load | Dashboard | **Open** — should only open from its CTA |
| 3 | **Duplicate headings/CTAs** — "Added rules" ×2 and "Add rule" ×2 on one screen; same pattern fixed earlier on Incidents/Releases | Automations | Fixed ✅ |
| 4 | **Bracket-text labels** — `[Recommended]` in indigo inside rule names | Automations | Removed ✅ (presets keep a quiet neutral pill) |
| 5 | **Second accent colour** — indigo competing with brand blue on interactive elements (~25 usages across 2 features) | Automations, Reply Kit | Swept to brand blue ✅. Rule: one accent for interaction; reserved hues only for categorical data badges |
| 6 | **Card-per-row lists** — each automation rule a floating shadowed card; meta columns drifting per row | Automations | One bordered table, fixed-width columns, tabular numerals ✅ |
| 7 | **Redundant columns** — "#" row numbers with no meaning; a Category column under category group headers repeating the header | Reply Kit tags | Both removed; group headers carry counts ✅ |
| 8 | **Empty-state theatre** — large icon + caption panels where a link or nothing would do | Run history, Reports, Competitors | **Open** — worst offenders are the two screens still on mock data |

Fixed in this slice: patterns 3–7 on the two screens the founder flagged
(Automations, Reply Kit tags), plus the indigo sweep across both features.
Verified by re-rendering both screens, tsc/eslint/95 tests/production build.

## AppFollow parity — features

⚠️ From training knowledge; appfollow.io is not reachable from this sandbox.
Verify against their current product before treating this as gospel.

| Capability | AppFollow | ReviewBox today |
|---|---|---|
| Multi-store review inbox + reply | ✓ | ✓ (Play replies live; App Store draft-mode) |
| Auto-replies / rules | ✓ | ✓ surface exists, executor shipped M3-era |
| Tags / triage | ✓ | ✓ (+ zero-cost rules engine) |
| Ratings & sentiment analytics | ✓ | ✓ partial (real data) |
| ASO keywords | ✓ | ✓ partial |
| Competitors | ✓ | ✗ mock screen only |
| Integrations (Slack/Zendesk/Jira…) | ✓ | ✗ Slack partial; rest M4 |
| Agency/multi-workspace | ✓ | ✗ not a launch target |

Feature parity is the existing M3/M4 roadmap; this workstream is the
look-and-feel half. Full parity is not the launch bar — credible craft is.

## Next slices (in order)

1. **Dashboard**: collapse three banners into one status strip; setup modal
   opens only from its CTA (pattern 1+2).
2. **Inbox density pass** — the core screen; row height, filter bar, detail pane.
3. **Empty states**: replace icon-theatre with one-line + primary action;
   Reports/Competitors get honest "not built yet" labels (they are mock).
4. DS-002 (86 raw `<button>` → `<Button>`), DS-003 (gray-* → tokens) as touched.

## Tooling note

Requested "shadcn + Taste skill": no Taste skill exists in the catalog (checked
skills and plugins); the design plugin's `/design:critique` is desktop-only and
not loadable here. shadcn is in use via the repo's installed primitives —
`ui.shadcn.com` is blocked by this environment's network policy, so new
primitives get hand-written in the same idiom rather than pulled by CLI.
