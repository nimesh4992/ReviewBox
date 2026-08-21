import { describe, expect, it } from "vitest";

import { canBypassClerkForSyncCron } from "./sync-cron-auth";

describe("canBypassClerkForSyncCron", () => {
  it("bypasses Clerk only for a request bearing the configured cron secret", () => {
    expect(
      canBypassClerkForSyncCron(
        "Bearer cron-secret",
        "cron-secret",
        "production",
      ),
    ).toBe(true);

    expect(
      canBypassClerkForSyncCron(
        null,
        "cron-secret",
        "production",
      ),
    ).toBe(false);
  });

  it("does not bypass Clerk in production when the cron secret is missing", () => {
    expect(
      canBypassClerkForSyncCron(
        null,
        undefined,
        "production",
      ),
    ).toBe(false);
  });

  it("keeps local cron development working when no secret is configured", () => {
    expect(
      canBypassClerkForSyncCron(
        null,
        undefined,
        "development",
      ),
    ).toBe(true);
  });
});
