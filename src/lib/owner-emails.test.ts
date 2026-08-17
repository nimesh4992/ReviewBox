/**
 * Resolving "who do I email about this workspace".
 *
 * Three cron routes used to answer this three different ways, two of them one
 * workspace at a time. The risk in consolidating them is not that the code
 * stops working — it is that it quietly starts emailing a *different person*,
 * or silently stops emailing someone it used to. So the tests are mostly about
 * who comes back, not about the batching.
 *
 * The batching still gets pinned down, because the reason to do this at all is
 * that the per-workspace version could not survive the scale its own comments
 * claim ("200+ workspaces"), and because the helper it was extracted from
 * passed an unbounded `limit` to a Clerk API that caps at 500.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface MemberRow { workspace_id: string; clerk_user_id: string; role: string }

let members: MemberRow[] = [];
let memberError: { message: string } | null = null;
let requestedWorkspaceIds: string[] = [];

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: () => ({
      select: () => ({
        in: (_col: string, ids: string[]) => {
          requestedWorkspaceIds = ids;
          return Promise.resolve({ data: members, error: memberError });
        },
      }),
    }),
  }),
}));

interface ClerkUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  emailAddresses: Array<{ emailAddress: string }>;
}

let clerkUsers: ClerkUser[] = [];
let clerkCalls: string[][] = [];
let clerkThrowsAfter = Infinity;

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    users: {
      getUserList: async ({ userId }: { userId: string[]; limit: number }) => {
        clerkCalls.push(userId);
        if (clerkCalls.length > clerkThrowsAfter) throw new Error("clerk 503");
        return { data: clerkUsers.filter((u) => userId.includes(u.id)) };
      },
    },
  }),
}));

import { resolveWorkspaceOwners, pickOwnerPerWorkspace } from "./owner-emails";

function user(id: string, email: string, extra: Partial<ClerkUser> = {}): ClerkUser {
  return {
    id,
    firstName: null,
    lastName: null,
    username: null,
    emailAddresses: [{ emailAddress: email }],
    ...extra,
  };
}

beforeEach(() => {
  members = [];
  memberError = null;
  requestedWorkspaceIds = [];
  clerkUsers = [];
  clerkCalls = [];
  clerkThrowsAfter = Infinity;
  vi.restoreAllMocks();
});

describe("resolveWorkspaceOwners", () => {
  it("maps each workspace to its owner's email and name", async () => {
    members = [
      { workspace_id: "ws_1", clerk_user_id: "user_a", role: "owner" },
      { workspace_id: "ws_2", clerk_user_id: "user_b", role: "owner" },
    ];
    clerkUsers = [
      user("user_a", "ada@example.com", { firstName: "Ada", lastName: "Lovelace" }),
      user("user_b", "grace@example.com", { username: "grace" }),
    ];

    const owners = await resolveWorkspaceOwners(["ws_1", "ws_2"]);

    expect(owners.get("ws_1")).toEqual({
      clerkUserId: "user_a", email: "ada@example.com", name: "Ada Lovelace",
    });
    expect(owners.get("ws_2")).toEqual({
      clerkUserId: "user_b", email: "grace@example.com", name: "grace",
    });
  });

  it("uses one Clerk request for many workspaces", async () => {
    members = Array.from({ length: 40 }, (_, i) => ({
      workspace_id: `ws_${i}`, clerk_user_id: `user_${i}`, role: "owner",
    }));
    clerkUsers = members.map((m) => user(m.clerk_user_id, `${m.clerk_user_id}@example.com`));

    await resolveWorkspaceOwners(members.map((m) => m.workspace_id));

    // The whole point. The per-workspace version made 40 calls here.
    expect(clerkCalls).toHaveLength(1);
  });

  it("chunks so a large account cannot exceed Clerk's limit cap", async () => {
    members = Array.from({ length: 250 }, (_, i) => ({
      workspace_id: `ws_${i}`, clerk_user_id: `user_${i}`, role: "owner",
    }));
    clerkUsers = members.map((m) => user(m.clerk_user_id, `${m.clerk_user_id}@example.com`));

    const owners = await resolveWorkspaceOwners(members.map((m) => m.workspace_id));

    // getUserList caps `limit` at 500. The helper this replaced passed
    // `limit: clerkIds.length` unbounded, so it was correct only while the
    // account stayed small — a cliff with no warning on the approach.
    expect(clerkCalls).toHaveLength(3);
    for (const call of clerkCalls) expect(call.length).toBeLessThanOrEqual(100);
    expect(owners.size).toBe(250);
  });

  it("deduplicates workspace ids and shared owners", async () => {
    members = [
      { workspace_id: "ws_1", clerk_user_id: "user_a", role: "owner" },
      { workspace_id: "ws_2", clerk_user_id: "user_a", role: "owner" },
    ];
    clerkUsers = [user("user_a", "ada@example.com")];

    await resolveWorkspaceOwners(["ws_1", "ws_1", "ws_2"]);

    expect(requestedWorkspaceIds).toEqual(["ws_1", "ws_2"]);
    expect(clerkCalls[0]).toEqual(["user_a"]);
  });

  it("skips a workspace whose owner has no email on file", async () => {
    members = [{ workspace_id: "ws_1", clerk_user_id: "user_a", role: "owner" }];
    clerkUsers = [{ ...user("user_a", "x@example.com"), emailAddresses: [] }];

    const owners = await resolveWorkspaceOwners(["ws_1"]);
    expect(owners.has("ws_1")).toBe(false);
  });

  it("returns what it has when Clerk fails partway", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    members = Array.from({ length: 150 }, (_, i) => ({
      workspace_id: `ws_${i}`, clerk_user_id: `user_${i}`, role: "owner",
    }));
    clerkUsers = members.map((m) => user(m.clerk_user_id, `${m.clerk_user_id}@example.com`));
    clerkThrowsAfter = 1;

    const owners = await resolveWorkspaceOwners(members.map((m) => m.workspace_id));

    // Fail SOFT. Every caller is a cron whose job is to send as many of its
    // emails as it can; throwing would turn a partial send into no send.
    expect(owners.size).toBe(100);
  });

  it("returns empty rather than throwing when the member query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    memberError = { message: "connection reset" };

    await expect(resolveWorkspaceOwners(["ws_1"])).resolves.toEqual(new Map());
  });

  it("does not call Clerk at all for an empty list", async () => {
    await resolveWorkspaceOwners([]);
    expect(clerkCalls).toHaveLength(0);
  });
});

describe("pickOwnerPerWorkspace — who actually gets the email", () => {
  const MEMBERS = [
    { workspace_id: "ws_1", clerk_user_id: "user_member", role: "member" },
    { workspace_id: "ws_1", clerk_user_id: "user_owner",  role: "owner"  },
    { workspace_id: "ws_2", clerk_user_id: "user_admin",  role: "admin"  },
  ];

  it("prefers the owner regardless of row order", () => {
    // The member row comes first in MEMBERS on purpose — a `find`-first
    // implementation that forgot to filter by role would pass every other test
    // in this file and mail the wrong person.
    expect(pickOwnerPerWorkspace(MEMBERS, false).get("ws_1")).toBe("user_owner");
  });

  it("omits an owner-less workspace by default", () => {
    // weekly-digest and health/user-check behaviour: owner or nobody.
    expect(pickOwnerPerWorkspace(MEMBERS, false).has("ws_2")).toBe(false);
  });

  it("falls back to any member only when asked", () => {
    // trial-nudge behaviour, preserved deliberately — this consolidation is
    // not the place to decide who receives trial mail.
    expect(pickOwnerPerWorkspace(MEMBERS, true).get("ws_2")).toBe("user_admin");
  });

  it("still prefers the owner when the fallback is enabled", () => {
    expect(pickOwnerPerWorkspace(MEMBERS, true).get("ws_1")).toBe("user_owner");
  });
});
