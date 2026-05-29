import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockAuth          = vi.fn();
const mockCookiesGet    = vi.fn();
const mockCookiesSet    = vi.fn();
const mockGetWorkspaceId= vi.fn();
const mockGetServiceClient = vi.fn();
const mockAudit         = vi.fn();
const mockRateLimit     = vi.fn().mockResolvedValue({ allowed: true, remaining: 4, reset: 0 });

vi.mock("@clerk/nextjs/server",   () => ({ auth: mockAuth }));
vi.mock("next/headers",           () => ({
  cookies: vi.fn(() => ({
    get:    mockCookiesGet,
    set:    mockCookiesSet,
    delete: vi.fn(),
  })),
}));
vi.mock("@/lib/supabase-server",  () => ({
  getWorkspaceId:   mockGetWorkspaceId,
  getServiceClient: mockGetServiceClient,
}));
vi.mock("@/lib/audit",            () => ({ audit: mockAudit }));
vi.mock("@/lib/api-rate-limit",   () => ({ rateLimit: mockRateLimit }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/auth/slack/callback");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/auth/slack/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({ allowed: true, remaining: 4, reset: 0 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SLACK_CLIENT_ID;
    delete process.env.SLACK_CLIENT_SECRET;
  });

  it("redirects to /sign-in when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { GET } = await import("./route");
    const res = await GET(makeReq({ state: "abc", code: "xyz" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  it("redirects with reason=rate_limited when rate limit exceeded", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, reset: 0 });
    const { GET } = await import("./route");
    const res = await GET(makeReq({ state: "abc", code: "xyz" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("reason=rate_limited");
  });

  it("redirects with reason=csrf when state cookie is missing", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCookiesGet.mockReturnValue(undefined); // no cookie
    const { GET } = await import("./route");
    const res = await GET(makeReq({ state: "abc", code: "xyz" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("reason=csrf");
  });

  it("redirects with reason=csrf when state param does not match cookie", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCookiesGet.mockReturnValue({ value: "correct_state" });
    const { GET } = await import("./route");
    const res = await GET(makeReq({ state: "wrong_state", code: "xyz" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("reason=csrf");
  });

  it("redirects with reason=slack_error when Slack returns ok=false", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCookiesGet.mockImplementation((name: string) =>
      name === "slack_oauth_state" ? { value: "state_abc" } : undefined,
    );
    process.env.SLACK_CLIENT_ID     = "cid";
    process.env.SLACK_CLIENT_SECRET = "csec";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ ok: false, error: "invalid_code" }),
    }));
    const { GET } = await import("./route");
    const res = await GET(makeReq({ state: "state_abc", code: "bad_code" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("reason=slack_error");
  });
});
