import { describe, expect, it } from "vitest";

import { isConnectionHealthy, isSyncFailureStatus } from "./sync-status";

describe("isSyncFailureStatus", () => {
  it("does not treat a verified connection as a failure", () => {
    // The reported bug: passing the Google Play connection test wrote
    // `credentials_verified`, and the dashboard read anything other than
    // "success" as broken — so the modal said "Connection verified!" while the
    // banner behind it said "can't sync yet · Finish setup".
    expect(isSyncFailureStatus("credentials_verified")).toBe(false);
  });

  it("does not treat a completed sync as a failure", () => {
    expect(isSyncFailureStatus("success")).toBe(false);
  });

  it("does not treat 'never attempted' as a failure", () => {
    expect(isSyncFailureStatus(null)).toBe(false);
    expect(isSyncFailureStatus(undefined)).toBe(false);
    expect(isSyncFailureStatus("")).toBe(false);
  });

  it("reports every real classifySyncError status as a failure", () => {
    for (const status of [
      "store_blocked_scraping",
      "needs_play_console_access",
      "google_credentials_invalid",
      "package_not_found",
      "needs_app_store_credentials",
      "bundle_id_not_found",
      "app_store_unauthorized",
      "store_api_error",
      "missing_store_id",
    ]) {
      expect(isSyncFailureStatus(status)).toBe(true);
    }
  });

  it("treats an unrecognised status as a failure rather than assuming health", () => {
    expect(isSyncFailureStatus("something_new_we_added_later")).toBe(true);
  });
});

describe("isConnectionHealthy", () => {
  it("is true once a sync succeeded or the credentials were verified", () => {
    expect(isConnectionHealthy("success")).toBe(true);
    expect(isConnectionHealthy("credentials_verified")).toBe(true);
  });

  it("is false when nothing has been attempted or the last attempt failed", () => {
    expect(isConnectionHealthy(null)).toBe(false);
    expect(isConnectionHealthy("package_not_found")).toBe(false);
  });
});
