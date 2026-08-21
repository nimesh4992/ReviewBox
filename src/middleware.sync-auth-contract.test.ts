import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("sync middleware auth boundary", () => {
  it("lets only cron-authorized sync requests bypass Clerk", () => {
    const source = readFileSync(join(process.cwd(), "src", "middleware.ts"), "utf8");

    expect(source).not.toContain('"/api/sync/(.*)"');
    expect(source).toContain("canBypassClerkForSyncCron(");
    expect(source).toContain('request.nextUrl.pathname === "/api/sync/reviews"');
  });
});
