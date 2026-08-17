/**
 * owner-emails.ts — resolve "who do I email about this workspace", in bulk.
 *
 * Three cron routes need the same thing: given a list of workspaces, the email
 * address of each one's owner. All three had their own implementation, and two
 * of them did it one workspace at a time inside a loop:
 *
 *   - weekly-digest  — `clerk.users.getUser()` per workspace, inside a
 *     Promise.allSettled batch of 10
 *   - trial-nudge    — `getOwnerEmail(workspaceId)` per workspace, serially
 *   - health/user-check — already batched, with a comment saying so
 *
 * At today's four workspaces the N+1 costs nothing, which is exactly why it
 * survived. It stops being free at the scale these crons are written for:
 * weekly-digest's own comment says it is built for "200+ workspaces", and 200
 * sequential Clerk calls inside a 60s function is how a Monday digest silently
 * sends to the first sixty owners and times out before the rest — with the
 * route still answering 200, because `Promise.allSettled` swallows the
 * cancellation.
 *
 * One DB query and one Clerk call per 100 workspaces instead.
 *
 * ── Chunking is not optional ─────────────────────────────────────────────────
 *
 * The batched version this was extracted from passed `limit: clerkIds.length`
 * to `getUserList` with no upper bound. Clerk caps `limit` at 500 and rejects
 * anything higher, so that helper was correct only while the account stayed
 * under 500 workspaces — a cliff with no warning on the way to it. Requests are
 * chunked here so the bound is a property of this function rather than of how
 * many customers we have.
 */

import { clerkClient } from "@clerk/nextjs/server";

import { getServiceClient } from "@/lib/supabase-server";

/** Clerk's getUserList caps `limit` at 500; 100 keeps each request small. */
const CLERK_CHUNK = 100;

export interface WorkspaceOwner {
  clerkUserId: string;
  email: string;
  /** Best available display name, never empty — falls back to "there". */
  name: string;
}

export interface ResolveOwnersOptions {
  /**
   * When a workspace has no row with `role = 'owner'`, fall back to any
   * member.
   *
   * Off by default, which matches weekly-digest and health/user-check. Only
   * trial-nudge opted into the fallback, and it keeps it — this module exists
   * to remove duplicate code, not to quietly change who receives mail.
   */
  fallbackToAnyMember?: boolean;
}

/** Clerk user → the display name we address them by. */
function displayName(user: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  emailAddresses: Array<{ emailAddress: string }>;
}): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return (
    full ||
    user.username ||
    user.emailAddresses[0]?.emailAddress?.split("@")[0] ||
    "there"
  );
}

/**
 * Map each workspace id to its owner's email and name.
 *
 * Workspaces with no members, no owner (unless `fallbackToAnyMember`), or no
 * email on the Clerk account are simply absent from the map — callers skip
 * them, which is what all three did individually before.
 *
 * Fails SOFT: a Clerk or database failure logs and returns whatever was
 * resolved, rather than throwing. Every caller is a cron whose job is to send
 * as many of its emails as it can; taking the whole run down because one Clerk
 * request failed would turn a partial send into no send at all.
 */
export async function resolveWorkspaceOwners(
  workspaceIds: string[],
  opts: ResolveOwnersOptions = {},
): Promise<Map<string, WorkspaceOwner>> {
  const result = new Map<string, WorkspaceOwner>();
  const ids = [...new Set(workspaceIds)].filter(Boolean);
  if (!ids.length) return result;

  let wsToClerk: Map<string, string>;

  try {
    const sb = getServiceClient();
    const { data: members, error } = await sb
      .from("workspace_members")
      .select("workspace_id, clerk_user_id, role")
      .in("workspace_id", ids);

    if (error) {
      console.error("[owner-emails] member lookup failed:", error);
      return result;
    }

    wsToClerk = pickOwnerPerWorkspace(
      (members ?? []) as Array<{ workspace_id: string; clerk_user_id: string; role: string }>,
      opts.fallbackToAnyMember === true,
    );
  } catch (err) {
    console.error("[owner-emails] member lookup threw:", err);
    return result;
  }

  if (!wsToClerk.size) return result;

  const clerkIds = [...new Set(wsToClerk.values())];
  const byClerkId = new Map<string, { email: string; name: string }>();

  try {
    const clerk = await clerkClient();

    for (let i = 0; i < clerkIds.length; i += CLERK_CHUNK) {
      const chunk = clerkIds.slice(i, i + CLERK_CHUNK);
      const { data: users } = await clerk.users.getUserList({
        userId: chunk,
        limit: chunk.length,
      });

      for (const user of users) {
        const email = user.emailAddresses[0]?.emailAddress;
        if (!email) continue;
        byClerkId.set(user.id, { email, name: displayName(user) });
      }
    }
  } catch (err) {
    // Partial results are still worth returning — whatever chunks succeeded
    // before the failure are already in byClerkId.
    console.error("[owner-emails] Clerk lookup failed:", err);
  }

  for (const [workspaceId, clerkUserId] of wsToClerk) {
    const user = byClerkId.get(clerkUserId);
    if (!user) continue;
    result.set(workspaceId, { clerkUserId, email: user.email, name: user.name });
  }

  return result;
}

/**
 * Choose one member per workspace: the owner, or — only when asked — whoever
 * else is there.
 *
 * Exported for testing: this is the half with the branch in it, and the half
 * where "quietly emails a different person" would live if it were wrong.
 */
export function pickOwnerPerWorkspace(
  members: Array<{ workspace_id: string; clerk_user_id: string; role: string }>,
  fallbackToAnyMember: boolean,
): Map<string, string> {
  const owners = new Map<string, string>();
  const anyMember = new Map<string, string>();

  for (const m of members) {
    if (m.role === "owner") {
      if (!owners.has(m.workspace_id)) owners.set(m.workspace_id, m.clerk_user_id);
    } else if (!anyMember.has(m.workspace_id)) {
      anyMember.set(m.workspace_id, m.clerk_user_id);
    }
  }

  if (!fallbackToAnyMember) return owners;

  for (const [workspaceId, clerkUserId] of anyMember) {
    if (!owners.has(workspaceId)) owners.set(workspaceId, clerkUserId);
  }
  return owners;
}
