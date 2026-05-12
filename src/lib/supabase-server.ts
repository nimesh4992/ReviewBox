import { createClient } from "@supabase/supabase-js";

// Use the Supavisor pooler URL (transaction mode, port 6543) for server-side
// queries from Vercel serverless functions. Falls back to direct URL in dev.
// Get pooler URL from: Supabase dashboard → Settings → Database → Connection string → Transaction mode
function getDbUrl(): string {
  return (
    process.env.SUPABASE_DB_POOLER_URL ?? // transaction-mode pooler (prod)
    process.env.NEXT_PUBLIC_SUPABASE_URL!  // direct connection (dev fallback)
  );
}

export function getServiceClient() {
  return createClient(
    getDbUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false }, // server-side — never persist
      db: { schema: "public" },
    }
  );
}

// Get workspace_id for a clerk user
export async function getWorkspaceId(clerkUserId: string): Promise<string | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("workspace_members")
    .select("workspace_id")
    .eq("clerk_user_id", clerkUserId)
    .limit(1)
    .single();
  return data?.workspace_id ?? null;
}
