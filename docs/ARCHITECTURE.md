# ReviewIQ — Architecture

## Folder Architecture: Feature-Slice Design

Each domain is a self-contained slice under `src/features/`. Shared infrastructure lives at the root of `src/`. Nothing in `features/` imports from another feature slice.

```
features/
  reviews/        ← owns review queue UI + review data
  incidents/      ← owns incident detection + alerting UI
  releases/       ← owns release health tracking UI
  dashboard/      ← aggregates signals from other domains (read-only, no writes)
  settings/       ← workspace config UI
```

Cross-cutting: `hooks/`, `lib/`, `utils/`, `types/`, `store/`

---

## Data Flow

```
Supabase DB
    ↓
services/<domain>/<domain>-service.ts   (async functions, data transforms)
    ↓
hooks/use-<domain>.ts                   (React Query wrapper)
    ↓
features/<domain>/components/*.tsx      (UI renders query result)
```

Components never call Supabase directly. Services never know about React.

---

## Service Layer Contract

All service functions must:
- Be `async`
- Accept plain params, return plain objects (no React types)
- Handle null Supabase client (env vars missing) — throw `Error("Supabase not configured")` or return mock fallback during dev
- Named: `listX()`, `getX(id)`, `createX(data)`, `updateX(id, data)`, `deleteX(id)`

```ts
// Pattern
export async function listReviewQueue(): Promise<AppReview[]> {
  const db = getSupabaseClient();
  if (!db) return mockReviews; // dev fallback
  const { data, error } = await db.from("reviews").select("*");
  if (error) throw error;
  return data;
}
```

---

## State Architecture

| Store | What | Where |
|---|---|---|
| Zustand `useWorkspaceStore` | selectedApp, environment | `src/store/use-workspace-store.ts` |
| React Query | reviews, incidents, releases, dashboard data | per-hook in `src/hooks/` |
| Local `useState` | transient UI (modals open, form draft) | inside component |

Rule: if state is async or comes from server → React Query. If UI-only + global → Zustand. If UI-only + local → useState.

---

## Multi-Store Platform Design

`selectedApp` in Zustand store is the workspace context. All React Query keys should include it:

```ts
queryKey: ["reviews", "queue", selectedApp]
```

This enables future multi-app support without refactoring.

---

## Authentication (Not Yet Built)

When auth is added:
- Use Supabase Auth (`@supabase/auth-helpers-nextjs` or `@supabase/ssr`)
- Route protection via middleware (`src/middleware.ts`)
- Auth state should NOT go into Zustand — use Supabase session
- `(app)/layout.tsx` is the boundary for authenticated routes

---

## Supabase Schema (Planned)

```sql
-- Core tables (to be created)
reviews          (id, app_id, source, author, rating, text, app_version, device, country,
                  issue_tags, sentiment, priority, reply_status, escalation_state,
                  created_at, has_ai_suggestion, reply_text, replied_at)

incidents        (id, app_id, title, description, severity, owner, detected_at, resolved_at, status)

releases         (id, app_id, version, status, rating_delta, complaint_delta, rollout_pct, started_at)

apps             (id, name, platform, bundle_id, created_at)
```

---

## Platform Abstraction (Google Play + App Store)

`AppReview.source = "Google Play" | "App Store"` is the discriminator.

Service layer handles platform differences:
- Different API response shapes normalized to `AppReview` before returning
- UI components are platform-agnostic — they consume `AppReview`, not raw API shapes
- Platform-specific logic (reply API calls, etc.) lives in service, not components

---

## AI Feature Architecture (Stub → Full)

`hasAiSuggestion: boolean` on `AppReview` signals AI content available.

Planned flow:
```
Review created
    → background job calls Claude API (or similar)
    → generates reply suggestion + issue tags + sentiment
    → stored back on review row
    → `hasAiSuggestion = true`
    → UI shows suggestion in review detail panel
```

AI enrichment is async and non-blocking — reviews show without waiting for AI.

---

## Real-Time (Not Yet Built)

Supabase Realtime can push new reviews / incident updates. When implemented:
- Use `supabase.channel()` subscription in a hook
- Invalidate React Query cache on new events: `queryClient.invalidateQueries(["reviews"])`
- Don't store realtime data in Zustand — let React Query own it

---

## Build + Deploy Targets

- **Dev:** `npm run dev` (Next.js dev server, port 3000)
- **Prod:** Standard Next.js build (`npm run build && npm start`)
- **Deployment:** Vercel-ready (no custom server, pure Next.js)
- **Env:** `.env.local` for local, Vercel env vars for production
