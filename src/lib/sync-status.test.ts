import { describe, expect, it } from "vitest";

import { canPostRepliesViaApi, isConnectionHealthy, isSyncFailureStatus } from "./sync-status";

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

describe("canPostRepliesViaApi", () => {
  it("offers one-click posting for a connected Google Play app", () => {
    // The reported bug: this returned false for EVERY Play app, because the
    // check asked for `has_credentials` — the App Store's per-app key pair,
    // which a Play app never has. Play customers were told to copy the reply
    // and paste it into Play Console themselves.
    expect(
      canPostRepliesViaApi({ platform: "google_play", publisher_api_connected: true }),
    ).toBe(true);
  });

  it("does not offer it for a Play app that hasn't granted Console access", () => {
    expect(
      canPostRepliesViaApi({ platform: "google_play", publisher_api_connected: false }),
    ).toBe(false);
    expect(canPostRepliesViaApi({ platform: "google_play" })).toBe(false);
  });

  it("ignores has_credentials on Google Play, where it is meaningless", () => {
    expect(
      canPostRepliesViaApi({
        platform: "google_play",
        has_credentials: true,
        publisher_api_connected: false,
      }),
    ).toBe(false);
  });

  it("requires the key pair for App Store, not the Play Console flag", () => {
    expect(canPostRepliesViaApi({ platform: "app_store", has_credentials: true })).toBe(true);
    expect(canPostRepliesViaApi({ platform: "app_store", has_credentials: false })).toBe(false);
    expect(
      canPostRepliesViaApi({ platform: "app_store", publisher_api_connected: true }),
    ).toBe(false);
  });

  it("fails closed on an unknown platform", () => {
    expect(
      canPostRepliesViaApi({ platform: "amazon_appstore", has_credentials: true }),
    ).toBe(false);
  });
});
