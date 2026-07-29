# Release process — batching changes instead of deploying every push

**The problem.** Today produced a deployment for nearly every push: seven
branch pushes, several merges, plus two manual promotions of a branch build
to `app.tryreviewbox.com`. Half of those pushes were Markdown. The cost isn't
Vercel's bill — it's that **nobody can tell which deployment matters**, and
production changed several times without a deliberate decision to ship.

Three separate dials control this. They are independent; turn whichever you
want.

---

## Dial 1 — Stop building pushes that can't change the app *(ready now)*

`scripts/vercel-ignore-build.sh` skips a build when a push touches only
docs, agent role files, or Markdown. Production always builds, and anything
unexpected falls through to building — it can only under-skip, never
under-deploy.

**To enable (1 minute, founder):**
Vercel → your project → **Settings → Git → Ignored Build Step** → select
"Custom" and paste:

```
bash scripts/vercel-ignore-build.sh
```

Deliberately *not* in `vercel.json`: an unrecognised key there fails the
entire deployment (CLAUDE.md's standing warning), whereas a dashboard setting
cannot break the deploy config.

Effect: today's seven pushes would have produced **three** builds.

---

## Dial 2 — Deploy on your schedule, not on merge *(the "batch fixes" ask)*

Right now every merge into `master` deploys to production immediately. To
accumulate several merged fixes and ship them together, move production onto
its own branch:

**Setup (founder, one time):**
1. Create a `release` branch from the current `master`.
2. Vercel → **Settings → Git → Production Branch** → change from `master` to
   `release`.

**From then on:**

| Action | What deploys |
|---|---|
| Push to a `claude/*` branch | Preview only |
| Merge PR → `master` | Preview only (integration build) |
| Merge `master` → `release` | **Production** — one deploy per batch |

You review the accumulated changes once, merge `master → release` when you're
ready, and get a single production deployment. Rollback is unchanged: Vercel →
Deployments → previous green → Promote.

**Cost:** one extra merge per release, and you must remember to do it — a
fix sitting on `master` is *not* live. That trade is worth it once more than
one person (or session) is merging; it may be overhead while you're solo.
**My recommendation:** adopt this once branch protection is on and PRs merge
without your hand on every one. Until then, Dial 1 plus discipline is enough.

---

## Dial 3 — Stop promoting branch previews to production *(do this now)*

Twice today a branch preview was promoted to `app.tryreviewbox.com`. That
ships code that never passed through `master`, so:

- `master` no longer reflects what customers are running,
- the next `master` deploy silently reverts it,
- and no PR record explains what changed in production.

Use previews for verification, and let production come from the production
branch only. If something is urgent enough to promote, merge it first.

---

## What "done" means for a release

Before merging to the production branch:

1. All blocking CI checks green on `master`.
2. `GET /api/admin/probe/stores` returns `healthy` (or a known-and-accepted
   verdict) — see `docs/AUDIT_SYSTEM.md` Lens 5.
3. Any migration the release depends on is **already applied** in Supabase.
   Code ships tolerating a missing column; that tolerance is a safety net,
   not a plan.
4. `docs/today.md` says what is in the release.

## Still recommended, independently of all three dials

**Branch protection on `master` requiring green CI.** Three of today's
breakages came from merges that CI had already marked red. No release process
survives a red base branch.
