import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * Health probe. Actually pings Supabase so monitors detect real outages.
 * Returns 503 if any dependency is down. Does not leak version or build info.
 */
export async function GET() {
  const checks: Record<string, "ok" | "fail"> = {};

  try {
    const sb = getServiceClient();
    // Lightweight ping: count workspaces with head:true → no rows transferred
    const { error } = await sb
      .from("workspaces")
      .select("id", { count: "exact", head: true })
      .limit(1);
    checks.db = error ? "fail" : "ok";
  } catch {
    checks.db = "fail";
  }

  const allOk = Object.values(checks).every((s) => s === "ok");

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 },
  );
}
