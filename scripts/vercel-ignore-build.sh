#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" — decides whether a push deserves a build.
#
# Exit 0 = SKIP the build. Exit 1 = BUILD.
# (Vercel's convention, and deliberately fail-safe: any unexpected error
#  falls through to exit 1, so a broken script over-builds rather than
#  silently shipping nothing.)
#
# Why: every push produced a full build + deployment. On a docs-heavy day
# that is a stream of deployments for changes that cannot affect the running
# app — noise that makes it hard to see which deployment actually matters.
#
# Rule: skip only when a push touches NOTHING that can change app behaviour.
# Docs, the agent role files, and the PR template are safe to skip. Anything
# under src/, public/, supabase/, config files, package manifests or the
# workflow files gets built.
#
# Configure in Vercel → Settings → Git → Ignored Build Step:
#     bash scripts/vercel-ignore-build.sh
#
# Kept OUT of vercel.json on purpose: an invalid key there fails the whole
# deployment (see CLAUDE.md — vercel.json rejects unknown keys), while a
# dashboard setting cannot break the deploy config.

set -uo pipefail

# Production must always build. Never skip a deploy that serves customers.
if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "→ production deploy: building"
  exit 1
fi

# Vercel provides the previous commit for the branch. Without it we cannot
# diff, so build (fail-safe).
BASE="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$BASE" ]; then
  echo "→ no previous SHA to diff against: building"
  exit 1
fi

CHANGED=$(git diff --name-only "$BASE" HEAD 2>/dev/null) || {
  echo "→ diff failed: building"
  exit 1
}

if [ -z "$CHANGED" ]; then
  echo "→ no file changes detected: skipping"
  exit 0
fi

# Any path NOT matching the skip list forces a build.
BUILD_NEEDED=0
while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    docs/*|\
    .claude/*|\
    .github/PULL_REQUEST_TEMPLATE.md|\
    *.md)
      ;;                       # documentation-ish — cannot change the app
    *)
      echo "  needs build: $file"
      BUILD_NEEDED=1
      ;;
  esac
done <<< "$CHANGED"

if [ "$BUILD_NEEDED" -eq 1 ]; then
  echo "→ code changed: building"
  exit 1
fi

echo "→ docs-only change: skipping build"
exit 0
