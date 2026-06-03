import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// supabase-js client REQUIRES the HTTPS REST URL (https://xxx.supabase.co).
// The Postgres pooler URL (postgresql://, port 6543) is for direct DB libraries
// like `pg` — passing it here crashes every query. Do NOT add a fallback to it.

let _client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: "public" },
  });
  return _client;
}

// Get workspace_id for a clerk user. Returns null if user has no workspace yet.
export async function getWorkspaceId(clerkUserId: string): Promise<string | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("workspace_members")
    .select("workspace_id")
    .eq("clerk_user_id", clerkUserId)
    .limit(1)
    .maybeSingle();
  return (data?.workspace_id as string | null) ?? null;
}

// Return the caller's role in a workspace, or null if they're not a member.
export async function getWorkspaceRole(
  clerkUserId: string,
  workspaceId: string,
): Promise<string | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  return (data?.role as string | null) ?? null;
}

// True if the caller is the workspace owner (or an admin). Use to gate
// destructive / credential-writing mutations that a plain member must not do.
export async function isWorkspaceAdmin(
  clerkUserId: string,
  workspaceId: string,
): Promise<boolean> {
  const role = await getWorkspaceRole(clerkUserId, workspaceId);
  return role === "owner" || role === "admin";
}
