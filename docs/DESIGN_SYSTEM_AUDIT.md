# Design System Audit — ReviewBox

**Date:** 2026-05-29  
**Branch:** `fix/metadata-scrape-cache` (master equivalent)  
**Scope:** All `.tsx`/`.ts` files under `src/` excluding `src/components/ui/` (shadcn-managed)

---

## Summary

| Stat | Value |
|---|---|
| Total components | 52 (22 shared + 30 feature-scoped) |
| shadcn/ui primitives | 12 |
| CSS tokens defined (`--rb-*`) | 47 |
| Critical issues | 4 |
| Medium issues | 3 |
| Low issues | 4 |
| Total raw `gray-*` usages | 1,095 across 69 files |
| Total arbitrary font sizes | 538 across 63 files |
| Total arbitrary spacing values | 126 across 34 files |
| Raw `<button` (should be `<Button>`) | 86 across 32 files |

**Verdict:** Token foundation in `globals.css` is well-structured. The gap is adoption — the app layer rarely uses the defined tokens, defaulting to raw Tailwind gray scale and arbitrary px values instead.

---

## Token Definitions (`src/app/globals.css`)

### Defined `--rb-*` Tokens (47 total)

| Category | Tokens |
|---|---|
| Brand blue scale | `--rb-blue-50/100/200/300/400/500/600/700/800/900` |
| Semantic colors | `--rb-green-50/100/500/600`, `--rb-amber-100/500/600`, `--rb-red-100/400/500/600`, `--rb-purple-100/500/600` |
| Font families | `--rb-font-display`, `--rb-font-text`, `--rb-font-mono` |
| Foreground | `--rb-fg-1` (#1D1D1F), `--rb-fg-2` (#48484D), `--rb-fg-3` (#86868B), `--rb-fg-4` (#B0B0B8) |
| Background | `--rb-bg-canvas` (#F5F5F7), `--rb-bg-surface` (#FFF), `--rb-bg-raised`, `--rb-bg-sunken`, `--rb-bg-selected`, `--rb-bg-accent-soft`, `--rb-bg-hover` |
| Borders | `--rb-border-1/2/3` |
| Shadows | `--rb-shadow-xs/sm/md/lg/xl` |

### Missing Tokens (gaps exposed by audit)

| Token Needed | Value | Used In |
|---|---|---|
| `--rb-indigo-500` | `#5B5BD6` | Reply Kit + Automations (10 files, ~40 usages) |
| `--rb-indigo-600` | `#4a4ac4` / `#4f4fbf` | Reply Kit + Automations |
| `--rb-text-caption` | `11px` | 63 files |
| `--rb-text-label` | `12px` | 63 files |
| `--rb-text-body-sm` | `13px` | 63 files |
| `--rb-text-body` | `14px` | 63 files |
| `--rb-text-md` | `15px` | 63 files |
| `--rb-text-lg` | `16px` | 63 files |
| `--rb-panel-x` | `18px` | Card/panel horizontal padding (20+ usages) |

---

## Critical Issues

### C1 — Raw Tailwind gray scale instead of `--rb-*` tokens

**Count:** 1,095 occurrences · 69 files  
**Impact:** Dark mode breaks on gray usages; design changes require mass find-replace instead of single token edit.

The entire codebase uses `text-gray-*`, `bg-gray-*`, `border-gray-*` instead of the semantic `text-fg-*`, `bg-surface`, `bg-canvas` tokens that are already defined.

**Mapping:**

| Currently Used | Replace With |
|---|---|
| `text-gray-900` | `text-fg-1` |
| `text-gray-700` / `text-gray-800` | `text-fg-2` |
| `text-gray-500` / `text-gray-400` | `text-fg-3` |
| `text-gray-300` | `text-fg-4` |
| `bg-gray-50` / `bg-white` (surfaces) | `bg-surface` or `bg-canvas` |
| `bg-gray-100` | `bg-canvas` |
| `bg-gray-200` | `bg-raised` |
| `border-gray-100` | `border border-[--rb-border-1]` |
| `border-gray-200` | `border border-[--rb-border-2]` |

**Top offenders:**

| File | Hits | Fix Priority |
|---|---|---|
| `src/features/settings/components/app-connections.tsx` | 52 | High |
| `src/features/reply-kit/components/templates-tab.tsx` | 28 | High |
| `src/components/dashboard/google-play-setup-modal.tsx` | 41 | High |
| `src/features/automations/components/automation-hub.tsx` | 30 | High |
| `src/features/reply-kit/components/knowledge-base-tab.tsx` | 17 | Medium |
| `src/app/(app)/dashboard/page.tsx` | 15 | Medium |
| `src/app/compare/page.tsx` | 39 | Low (marketing) |

---

### C2 — Dark mode bypasses token layer in marketing pages

**Count:** ~80 occurrences · 20+ files  
**Impact:** Dark mode values hardcoded directly, duplicating what the token already resolves. Any design change requires two edits instead of one.

**Pattern found everywhere in marketing pages:**

```tsx
// ❌ Current — hardcoding token values
className="text-gray-900 dark:text-[#F5F5F7]"
className="text-gray-600 dark:text-[#86868B]"
className="bg-white dark:bg-[#161618]"
className="text-gray-400 dark:text-[#636366]"

// ✅ Fix — token resolves both modes automatically
className="text-fg-1"
className="text-fg-3"
className="bg-surface"
className="text-fg-4"
```

**Files:**

`src/app/compare/page.tsx`, `src/app/about/page.tsx`, `src/app/careers/page.tsx`, `src/app/blog/page.tsx`, `src/app/status/page.tsx`, `src/app/contact/page.tsx`, `src/app/pricing/page.tsx`, `src/app/customers/page.tsx`, `src/app/changelog/page.tsx`, `src/app/faq/page.tsx` and ~10 more marketing pages.

---

### C3 — Indigo accent `#5B5BD6` used with no token

**Count:** ~40 usages · 10 files  
**Impact:** Can't theme or adjust the secondary accent color. Reply Kit and Automations visually diverge from the rest of the app because the color has no semantic name.

**Fix — add to `globals.css`:**

```css
/* Add to :root */
--rb-indigo-500: #5B5BD6;
--rb-indigo-600: #4a4ac4;

/* Dark mode (add to .dark block) */
--rb-indigo-500: #7C7CF0;
--rb-indigo-600: #5B5BD6;
```

Then replace hardcoded values:

```tsx
// ❌ Current
style={{ backgroundColor: '#5B5BD6' }}
className="bg-[#5B5BD6] hover:bg-[#4a4ac4]"

// ✅ Fix
style={{ backgroundColor: 'var(--rb-indigo-500)' }}
className="bg-[--rb-indigo-500] hover:bg-[--rb-indigo-600]"
```

**Files:**

| File | Usages |
|---|---|
| `src/features/automations/components/automation-hub.tsx` | 6 |
| `src/features/automations/components/rule-builder-modal.tsx` | 7 |
| `src/features/reply-kit/components/templates-tab.tsx` | 10 |
| `src/features/reply-kit/components/tags-tab.tsx` | 2 |
| `src/features/reply-kit/components/knowledge-base-tab.tsx` | 7 |
| `src/features/reply-kit/components/ai-styles-tab.tsx` | 3 |
| `src/features/reply-kit/components/reply-kit.tsx` | 1 |
| `src/components/layout/cookie-banner.tsx` | 1 (wrong — should use brand blue) |

---

### C4 — Raw `<button>` instead of `<Button>` component

**Count:** 86 usages · 32 files  
**Impact:** Inconsistent focus rings (accessibility), no disabled state, no loading state, variable sizing, can't apply variant changes globally.

**Fix:** Replace with `<Button>` from `@/components/ui/button`:

```tsx
// ❌ Current
<button onClick={...} className="px-3 py-1.5 text-[13px] ...">
  Label
</button>

// ✅ Fix
<Button variant="ghost" size="sm" onClick={...}>
  Label
</Button>
```

**Top offenders:**

| File | Raw `<button>` count | Notes |
|---|---|---|
| `src/features/reviews/components/review-queue.tsx` | 22 | Filter chips, reply action buttons |
| `src/features/aso/components/aso-screen.tsx` | 17 | Tab selectors, action triggers |
| `src/features/automations/components/automation-hub.tsx` | 6 | Rule action buttons |
| `src/app/page.tsx` | 6 | Landing page CTAs — use `<Button asChild>` + `<Link>` |
| `src/app/onboarding/page.tsx` | 6 | Step nav buttons |
| `src/app/(app)/incidents/page.tsx` | 4 | Status filter chips |
| `src/features/settings/components/slack-integration.tsx` | 4 | Connect/disconnect |
| `src/features/reports/components/reports-screen.tsx` | 3 | Export/run actions |
| `src/components/dashboard/google-play-invite-modal.tsx` | 3 | Modal footer |
| `src/components/layout/top-navigation.tsx` | 1 | "Upgrade" CTA — critical, should be `<Button>` |

---

## Medium Issues

### M1 — No type scale tokens (538 arbitrary font sizes)

**Count:** 538 occurrences · 63 files  
**Impact:** No way to adjust type ramp globally. Design changes require mass grep-replace.

The recurring set across the entire app: `text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[13px]`, `text-[14px]`, `text-[15px]`, `text-[16px]`.

**Fix — add to `globals.css` and wire as Tailwind utilities:**

```css
/* Type scale tokens */
--rb-text-caption:  10px; /* micro labels, timestamps */
--rb-text-label:    11px; /* badges, tag chips */
--rb-text-xs:       12px; /* secondary metadata */
--rb-text-sm:       13px; /* body secondary */
--rb-text-body:     14px; /* primary body */
--rb-text-md:       15px; /* emphasized body */
--rb-text-lg:       16px; /* subheadings */

/* Add to @theme inline block */
--text-caption:     var(--rb-text-caption) / 1.2;
--text-label:       var(--rb-text-label)   / 1.3;
--text-xs:          var(--rb-text-xs)      / 1.4;
--text-sm:          var(--rb-text-sm)      / 1.5;
--text-body:        var(--rb-text-body)    / 1.5;
--text-md:          var(--rb-text-md)      / 1.5;
--text-lg:          var(--rb-text-lg)      / 1.4;
```

Then replace:
```tsx
text-[11px] → text-label
text-[12px] → text-xs
text-[13px] → text-sm
text-[14px] → text-body
```

---

### M2 — Arbitrary spacing values (126 usages)

**Count:** 126 occurrences · 34 files  
**Recurring patterns worth tokenizing:**

| Value | Occurrences | Meaning | Token |
|---|---|---|---|
| `px-[18px]` / `p-[18px]` | 20+ | Card/panel horizontal padding | `--rb-panel-x: 18px` |
| `h-[26px]` | 15+ | Badge/chip height (small) | `--rb-badge-h-sm: 26px` |
| `h-[30px]` | 10+ | Badge/chip height (default) | `--rb-badge-h: 30px` |
| `max-w-[1240px]` | 5+ | Max content width | `--rb-content-max: 1240px` |
| `w-[420px]` / `w-[480px]` | 3 | Review card panel widths | component-specific, keep as-is |
| `max-h-[90vh]` | 3 | Modal max height | acceptable, keep as-is |

---

### M3 — Brand blue used as raw hex string

**Count:** ~60 files use `#0A84FF` directly  
**Impact:** Low right now, but means changing the brand color requires grepping every file.

`--brand: #0A84FF` is already defined in `globals.css`.

```tsx
// ❌ Current
className="text-[#0A84FF]"
style={{ color: '#0A84FF' }}

// ✅ Fix
className="text-[--brand]"
style={{ color: 'var(--brand)' }}
```

For Tailwind classes where the semantic equivalent exists:
```tsx
className="text-primary"   // replaces text-[#0A84FF]
className="bg-primary"     // replaces bg-[#0A84FF]
className="border-primary" // replaces border-[#0A84FF]
```

---

## Low Issues

### L1 — `#0070e0` used instead of `--rb-blue-600`

**Files:** `src/app/compare/page.tsx:188`, `src/components/dashboard/google-play-setup-modal.tsx:281`, `src/app/blog/ai-cost-reduction/page.tsx:219` (5 total)

`--rb-blue-600` is `#006EE0` — nearly identical, likely the same intent.

```tsx
// ❌
className="hover:text-[#0070e0]"
// ✅
className="hover:text-[--rb-blue-600]"
```

---

### L2 — `#1a1d27` and `#0f1117` not mapped to any token

**Files:** `src/components/dashboard/upgrade-toast.tsx:41`, `src/components/layout/app-shell.tsx:21`

These are dark surface colors. Closest token is `--rb-bg-surface` (dark: `#161618`) — not exact matches, so either:
- Map to existing dark token (close enough)
- Define `--rb-bg-elevated-dark: #1a1d27` for slightly elevated dark surfaces

---

### L3 — `#1F8A5B` / `#DC2626` / `#F59E0B` used raw in data/chart files

**Files:** `src/features/dashboard/data/operations.ts`, `src/features/aso/components/aso-screen.tsx`, `src/features/competitors/components/competitors-screen.tsx`

These match existing tokens:

| Raw | Token |
|---|---|
| `#1F8A5B` | `var(--rb-green-500)` |
| `#DC2626` | `var(--rb-red-500)` |
| `#F59E0B` / `#C97A00` | `var(--rb-amber-500)` |
| `#6366f1` | No token — should be `--rb-indigo-500` (see C3) |
| `#ef4444` | Use `--rb-red-400` instead |

---

### L4 — Slack brand color has no token

**File:** `src/features/settings/components/slack-integration.tsx:185`  
`#4A154B` (Slack purple) used for the Slack connect button background.

Acceptable as a third-party brand color. Add a comment noting it's intentional to prevent future "fix this" passes:

```tsx
{/* Slack brand purple — intentional, not an --rb-* token */}
className="bg-[#4A154B] hover:bg-[#3b1040]"
```

---

## Acceptable (No Fix Needed)

| Item | Reason |
|---|---|
| `src/components/auth/clerk-appearance.ts` hex values | Clerk API requires hex strings — can't use CSS vars |
| Email template inline styles (`src/lib/email/`) | Standalone HTML, intentionally independent |
| `src/app/sentry-example-page/` colors | Sentry demo page, not real product UI |
| `src/features/dashboard/components/platform-health.tsx` logo SVG colors | Google/Apple brand colors in SVG — intentional |
| `max-h-[90vh]` / `max-w-[440px]` layout constraints | One-off layout values, not worth tokenizing |

---

## Component Inventory

### Shared Components (`src/components/`)

| Directory | Components |
|---|---|
| `layout/` | `app-shell`, `cookie-banner`, `credentials-banner`, `legal-page-layout`, `marketing-footer`, `marketing-nav`, `marketing-shell`, `page-header`, `sidebar`, `top-navigation`, `user-menu` |
| `dashboard/` | `empty-workspace-welcome`, `google-play-invite-modal`, `google-play-setup-modal`, `trial-banner`, `upgrade-toast` |
| `auth/` | `auth-shell`, `clerk-appearance` |
| `providers/` | `posthog-provider`, `query-provider`, `sentry-identify`, `theme-provider` |
| `settings/` | `danger-zone` |
| `marketing/` | `roi-calculator` |

### Feature Components (`src/features/*/components/`) — 30 total

`aso`, `automations` (2), `competitors`, `dashboard` (6), `incidents` (2), `releases` (2), `reply-kit` (5), `reports`, `reviews` (3), `sentiment`, `settings` (6)

### shadcn/ui Primitives (`src/components/ui/`) — 12 total

`badge`, `button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `sheet`, `skeleton`, `table`, `tabs`, `tooltip`

---

## Fix Priority Order

| Priority | Issue | Effort | Impact |
|---|---|---|---|
| 1 | Add `--rb-indigo-*` tokens to `globals.css` (C3) | 10 min | Unblocks 40 usages |
| 2 | Define type scale tokens + Tailwind utilities (M1) | 30 min | Cuts 538 arbitrary values |
| 3 | `app-connections.tsx` — replace 52 `gray-*` with tokens (C1) | 1h | Highest single-file density |
| 4 | `templates-tab.tsx` + `automation-hub.tsx` — token migration (C1) | 1h | 58 hits combined |
| 5 | `google-play-setup-modal.tsx` — gray-* + dark mode (C1 + C2) | 45 min | 41 hits |
| 6 | Marketing pages dark mode pattern — `text-fg-*` / `bg-surface` (C2) | 2h | 80 dark: hardcodes |
| 7 | `review-queue.tsx` — replace 22 raw `<button>` (C4) | 1.5h | Biggest a11y win |
| 8 | `aso-screen.tsx` — replace 17 raw `<button>` (C4) | 1h | |
| 9 | Add `px-[18px]` → `--rb-panel-x` spacing token (M2) | 20 min | |
| 10 | `#0A84FF` → `var(--brand)` / `text-primary` (M3) | 2h | Polish |

---

## What Works Well

- Token foundation is complete and well-layered (brand scale → semantic → shadcn bridge)
- Dark mode tokens exist and are correct — the problem is components not using them
- `cn()` helper used consistently for conditional class merging
- shadcn/ui primitives cleanly isolated — never edited, safe to upgrade
- No CSS modules or styled-components leaking into the codebase
- `--rb-*` namespace is clean and collision-free
