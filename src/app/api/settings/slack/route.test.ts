import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import * as supabaseServer from "@/lib/supabase-server";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockAuth           = vi.fn();
const mockAudit          = vi.fn();
const mockRateLimit      = vi.fn().mockResolvedValue({ allowed: true, remaining: 4, reset: 0 });

vi.mock("@clerk/nextjs/server",  () => ({ auth: mockAuth }));
vi.mock("@/lib/audit",           () => ({ audit: mockAudit }));
vi.mock("@/lib/api-rate-limit",  () => ({ rateLimit: mockRateLimit }));
vi.mock("@/lib/supabase-server", () => ({
  getWorkspaceId:   vi.fn(),
  getServiceClient: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(): NextRequest {
  return new NextRequest("http://localhost:3000/api/settings/slack", { method: "DELETE" });
}

function mockSb(tokenRow: { access_token: string } | null) {
  vi.mocked(supabaseServer.getServiceClient).mockReturnValue({
    from: (table: string) => {
      if (table === "workspace_slack") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: tokenRow }) }) }),
          delete: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === "workspaces") {
        return { update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
      }
      return {};
    },
  } as never);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DELETE /api/settings/slack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({ allowed: true, remaining: 4, reset: 0 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { DELETE } = await import("./route");
    const res = await DELETE(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 404 when workspace has no Slack connection", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    vi.mocked(supabaseServer.getWorkspaceId).mockResolvedValue("ws_1");
    mockSb(null);
    const { DELETE } = await import("./route");
    const res = await DELETE(makeReq());
    expect(res.status).toBe(404);
  });

  it("returns { ok: true } and calls audit on success", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    vi.mocked(supabaseServer.getWorkspaceId).mockResolvedValue("ws_1");
    mockSb({ access_token: "xoxb-test" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const { DELETE } = await import("./route");
    const res  = await DELETE(makeReq());
    const body = (await res.json()) as { ok: boolean };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "slack.disconnect" }),
    );
  });

  it("still returns { ok: true } when auth.revoke network call fails", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    vi.mocked(supabaseServer.getWorkspaceId).mockResolvedValue("ws_1");
    mockSb({ access_token: "xoxb-test" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const { DELETE } = await import("./route");
    const res  = await DELETE(makeReq());
    const body = (await res.json()) as { ok: boolean };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, reset: 0 });
    const { DELETE } = await import("./route");
    const res = await DELETE(makeReq());
    expect(res.status).toBe(429);
  });
});
