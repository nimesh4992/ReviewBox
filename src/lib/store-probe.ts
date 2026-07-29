/**
 * store-probe.ts
 *
 * Asks the real stores whether the product still works — from wherever this
 * code is running.
 *
 * Unit tests prove our logic is self-consistent against mocked upstreams.
 * They cannot tell us that Google rotated its markup last night, that our
 * server IP is being refused, or that a customer's app is invisible on the
 * storefront we happen to query. Every one of those has already happened
 * here, and each was found by a human noticing an empty screen.
 *
 * So this probe runs the SAME code paths the product uses, against real
 * fixture apps from docs/PRODUCT_CONTEXT.md, and reports what actually came
 * back. Run it from production (that is the IP that matters) via
 * GET /api/admin/probe/stores.
 *
 * The fixtures are chosen so the failure PATTERN is diagnostic:
 *   - regional app fails, global app works  → our storefront handling
 *   - every Google check fails, Apple works → Google is refusing our IP
 *   - everything fails                      → our egress or a total outage
 */

import { searchStore, fetchAppMetadata, type StorePlatform } from "@/services/store-search";
import { bootstrapReviews } from "@/services/bootstrap-reviews";

export interface ProbeCheck {
  /** Stable id so results can be diffed between runs. */
  id: string;
  /** What this proves, in the founder's language. */
  claim: string;
  upstream: "google" | "apple";
  ok: boolean;
  detail: string;
  ms: number;
}

export type ProbeVerdict =
  | "healthy"
  | "google_blocked"
  | "apple_blocked"
  | "regional_handling_broken"
  | "degraded"
  | "all_upstreams_unreachable";

export interface ProbeReport {
  verdict: ProbeVerdict;
  summary: string;
  checks: ProbeCheck[];
  ranAt: string;
}

/**
 * Turn raw check results into a verdict that names the LIKELY CAUSE rather
 * than restating the failures. Pure — unit-tested.
 */
export function verdictFor(checks: ProbeCheck[]): { verdict: ProbeVerdict; summary: string } {
  if (!checks.length) return { verdict: "degraded", summary: "No checks ran." };

  const google = checks.filter((c) => c.upstream === "google");
  const apple  = checks.filter((c) => c.upstream === "apple");
  const failed = checks.filter((c) => !c.ok);

  if (!failed.length) {
    return { verdict: "healthy", summary: "All store paths working, including the region-locked app." };
  }

  const googleAllFail = google.length > 0 && google.every((c) => !c.ok);
  const appleAllFail  = apple.length  > 0 && apple.every((c) => !c.ok);

  if (googleAllFail && appleAllFail) {
    return {
      verdict: "all_upstreams_unreachable",
      summary:
        "Neither Google nor Apple responded. Most likely our own network egress, not the stores.",
    };
  }

  if (googleAllFail) {
    return {
      verdict: "google_blocked",
      summary:
        "Every Google Play check failed while Apple works — Google is refusing this server. " +
        "Draft Mode cannot deliver Play Store data from here; connecting Play Console becomes mandatory.",
    };
  }

  if (appleAllFail) {
    return {
      verdict: "apple_blocked",
      summary: "Every App Store check failed while Google works — Apple-side outage or block.",
    };
  }

  // Partial failure: is it specifically the regional app? That is the
  // signature of storefront handling breaking again.
  const regionalFailed = failed.some((c) => c.id.includes("regional"));
  const globalOk = checks.some((c) => c.id.includes("global") && c.ok);
  if (regionalFailed && globalOk) {
    return {
      verdict: "regional_handling_broken",
      summary:
        "The global app works but the region-locked app does not — storefront handling has regressed. " +
        "This is the Mumbai One failure mode.",
    };
  }

  return {
    verdict: "degraded",
    summary: `${failed.length} of ${checks.length} checks failed — see details.`,
  };
}

async function timed(
  id: string,
  claim: string,
  upstream: "google" | "apple",
  run: () => Promise<string>,
): Promise<ProbeCheck> {
  const started = Date.now();
  try {
    const detail = await run();
    return { id, claim, upstream, ok: true, detail, ms: Date.now() - started };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return { id, claim, upstream, ok: false, detail: raw.slice(0, 200), ms: Date.now() - started };
  }
}

/** Fixtures mirror docs/PRODUCT_CONTEXT.md. Keep the two in sync. */
const REGIONAL_APP = { platform: "google-play" as StorePlatform, storeId: "com.mmrda.mumbaione", name: "Mumbai One", country: "in" };
const GLOBAL_APP   = { platform: "google-play" as StorePlatform, storeId: "com.whatsapp",        name: "WhatsApp",   country: "us" };
const IOS_APP      = { platform: "app-store"   as StorePlatform, storeId: "com.burbn.instagram", name: "Instagram",  country: "us" };

export async function runStoreProbe(): Promise<ProbeReport> {
  const checks = await Promise.all([
    timed(
      "google-search-regional",
      "A customer can find a region-locked app by NAME (the Mumbai One case)",
      "google",
      async () => {
        const results = await searchStore(REGIONAL_APP.platform, REGIONAL_APP.name, 10);
        const hit = results.find((r) => r.storeId === REGIONAL_APP.storeId);
        if (!hit) {
          throw new Error(
            `"${REGIONAL_APP.name}" did not return ${REGIONAL_APP.storeId}. ` +
            `Got: ${results.slice(0, 4).map((r) => r.storeId).join(", ") || "nothing"}`,
          );
        }
        // A result whose name is just its package ID means the parser broke
        // and something fell through to a bare-ID path.
        if (hit.name === hit.storeId) throw new Error("result has no real app name — parser regression");
        return `found "${hit.name}" in storefront ${hit.country}`;
      },
    ),

    timed(
      "google-search-global",
      "Name search works for a global app (isolates regional bugs from outages)",
      "google",
      async () => {
        const results = await searchStore(GLOBAL_APP.platform, GLOBAL_APP.name, 10);
        if (!results.some((r) => r.storeId === GLOBAL_APP.storeId)) {
          throw new Error(`"${GLOBAL_APP.name}" did not return ${GLOBAL_APP.storeId}`);
        }
        return `${results.length} results`;
      },
    ),

    timed(
      "google-paste-id-regional",
      "Pasting a package ID resolves the app, as the search box promises",
      "google",
      async () => {
        const results = await searchStore(REGIONAL_APP.platform, REGIONAL_APP.storeId, 5);
        if (!results.length) throw new Error("pasted package ID resolved to nothing");
        return `resolved to "${results[0].name}" (${results[0].country})`;
      },
    ),

    timed(
      "google-metadata-regional",
      "Rating and review count can be read for a region-locked app",
      "google",
      async () => {
        const meta = await fetchAppMetadata(REGIONAL_APP.platform, REGIONAL_APP.storeId, REGIONAL_APP.country);
        if (!meta) throw new Error("no metadata returned");
        if (meta.rating === null) throw new Error("metadata returned without a rating");
        return `${meta.rating}★, ${meta.reviewCount ?? "?"} ratings`;
      },
    ),

    timed(
      "google-reviews-regional",
      "PUBLIC reviews actually arrive for a region-locked app — the promise that was silently broken",
      "google",
      async () => {
        const rows = await bootstrapReviews(
          "google_play", "probe", "probe", REGIONAL_APP.storeId, REGIONAL_APP.country,
        );
        if (!rows.length) throw new Error("zero reviews scraped — Draft Mode delivers nothing for this app");
        return `${rows.length} reviews`;
      },
    ),

    timed(
      "apple-search-global",
      "App Store search works (different upstream — isolates Google-specific blocks)",
      "apple",
      async () => {
        const results = await searchStore(IOS_APP.platform, IOS_APP.name, 10);
        if (!results.length) throw new Error("no App Store results");
        return `${results.length} results`;
      },
    ),

    timed(
      "apple-metadata-global",
      "App Store metadata can be read",
      "apple",
      async () => {
        const meta = await fetchAppMetadata(IOS_APP.platform, IOS_APP.storeId, IOS_APP.country);
        if (!meta) throw new Error("no metadata returned");
        return `${meta.name} — ${meta.rating ?? "?"}★`;
      },
    ),
  ]);

  const { verdict, summary } = verdictFor(checks);
  return { verdict, summary, checks, ranAt: new Date().toISOString() };
}
