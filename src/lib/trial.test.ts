import { describe, expect, it } from "vitest";

import {
  daysUntil,
  decideExtension,
  getTrialStatus,
  isTrialExpired,
  resolveTrialEligibility,
  trialClaimKey,
} from "./trial";

const NOW = new Date("2026-08-16T12:00:00Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

describe("getTrialStatus", () => {
  it("reports days left while the trial is running", () => {
    expect(getTrialStatus({ plan: "trial", trial_ends_at: inDays(10) }, NOW)).toEqual({
      state: "active",
      daysLeft: 10,
    });
  });

  it("flags the last few days so nudges have something to fire on", () => {
    expect(getTrialStatus({ plan: "trial", trial_ends_at: inDays(2) }, NOW)).toEqual({
      state: "ending_soon",
      daysLeft: 2,
    });
  });

  it("reports expired once the end date has passed", () => {
    expect(getTrialStatus({ plan: "trial", trial_ends_at: inDays(-1) }, NOW)).toEqual({
      state: "expired",
      daysLeft: 0,
    });
  });

  it("treats a trial with no end date as active, not expired", () => {
    // These rows exist: trial_ends_at was added after some workspaces were
    // created. Defaulting them to expired would cancel real customers to
    // punish a data gap, so this deliberately fails open.
    expect(getTrialStatus({ plan: "trial", trial_ends_at: null }, NOW).state).toBe("active");
  });

  it("says nothing about workspaces that are not trialling", () => {
    expect(getTrialStatus({ plan: "pro", trial_ends_at: inDays(-40) }, NOW)).toEqual({
      state: "not_trialling",
      daysLeft: null,
    });
    // A paying customer whose old trial date is long past must never be
    // downgraded by the expiry cron.
    expect(isTrialExpired({ plan: "pro", trial_ends_at: inDays(-40) }, NOW)).toBe(false);
    expect(isTrialExpired({ plan: "free", trial_ends_at: inDays(-40) }, NOW)).toBe(false);
  });

  it("does not expire on the boundary minute", () => {
    const endsAt = new Date(NOW.getTime() + 60_000).toISOString();
    expect(isTrialExpired({ plan: "trial", trial_ends_at: endsAt }, NOW)).toBe(false);
  });
});

describe("daysUntil", () => {
  it("rounds up so a part-day still counts as a day left", () => {
    expect(daysUntil(new Date(NOW.getTime() + 1.2 * 86_400_000).toISOString(), NOW)).toBe(2);
  });

  it("never returns a negative number", () => {
    expect(daysUntil(inDays(-9), NOW)).toBe(0);
  });

  it("survives an unparseable date", () => {
    expect(daysUntil("not a date", NOW)).toBe(0);
  });
});

describe("decideExtension", () => {
  it("extends from the current end date, not from today", () => {
    // Extending from `now` on a trial with 8 days left would silently shorten
    // it to 14 — and they only get one extension, so it is unrecoverable.
    const d = decideExtension({ plan: "trial", trial_ends_at: inDays(8) }, NOW);
    expect(d.allowed).toBe(true);
    expect(daysUntil(d.newEndsAt!, NOW)).toBe(22);
  });

  it("extends from today when the trial already lapsed", () => {
    const d = decideExtension({ plan: "trial", trial_ends_at: inDays(-3) }, NOW);
    expect(d.allowed).toBe(true);
    expect(daysUntil(d.newEndsAt!, NOW)).toBe(14);
  });

  it("allows exactly one extension", () => {
    const once = decideExtension(
      { plan: "trial", trial_ends_at: inDays(5), trial_extensions_used: 1 },
      NOW,
    );
    expect(once.allowed).toBe(false);
    expect(once.reason).toMatch(/already been extended/i);
  });

  it("refuses to extend a workspace that is not on a trial", () => {
    expect(decideExtension({ plan: "pro", trial_ends_at: inDays(5) }, NOW).allowed).toBe(false);
    expect(decideExtension({ plan: "free", trial_ends_at: null }, NOW).allowed).toBe(false);
  });
});

describe("trialClaimKey", () => {
  it("normalises case and whitespace so one app is one key", () => {
    expect(trialClaimKey("google_play", " com.MMRDA.MumbaiOne ")).toBe(
      "google_play:com.mmrda.mumbaione",
    );
  });

  it("keeps the same store id on different platforms apart", () => {
    expect(trialClaimKey("google_play", "com.acme")).not.toBe(trialClaimKey("app_store", "com.acme"));
  });
});

describe("resolveTrialEligibility", () => {
  it("grants a trial when nobody has claimed the app", () => {
    expect(
      resolveTrialEligibility({ claimedByWorkspaceId: null, thisWorkspaceId: "ws1" }),
    ).toEqual({ plan: "trial", previouslyClaimed: false });
  });

  it("still grants a trial when the same workspace re-claims its own app", () => {
    // Re-running onboarding, or removing an app and adding it back, must not
    // cost the customer their trial.
    expect(
      resolveTrialEligibility({ claimedByWorkspaceId: "ws1", thisWorkspaceId: "ws1" }),
    ).toEqual({ plan: "trial", previouslyClaimed: false });
  });

  it("starts a second workspace on free when the app already trialled", () => {
    // The exploit this exists for: a new email address every fortnight for the
    // same app. They can still use the product — they just don't get another
    // free run at it.
    expect(
      resolveTrialEligibility({ claimedByWorkspaceId: "ws1", thisWorkspaceId: "ws2" }),
    ).toEqual({ plan: "free", previouslyClaimed: true });
  });
});
