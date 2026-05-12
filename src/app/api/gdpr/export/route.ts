import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getWorkspaceId(userId);

  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const sb = getServiceClient();

  const [
    workspaceRes,
    appsRes,
    reviewsRes,
    templatesRes,
    knowledgeBaseRes,
    alertPreferencesRes,
    automationRulesRes,
    aiUsageRes,
  ] = await Promise.all([
    sb.from("workspaces").select("*").eq("id", workspaceId).single(),
    sb.from("apps").select("*").eq("workspace_id", workspaceId),
    sb.from("reviews").select("*").eq("workspace_id", workspaceId).limit(10000),
    sb.from("reply_templates").select("*").eq("workspace_id", workspaceId),
    sb.from("knowledge_base").select("*").eq("workspace_id", workspaceId),
    sb.from("alert_preferences").select("*").eq("workspace_id", workspaceId),
    sb.from("automation_rules").select("*").eq("workspace_id", workspaceId),
    sb.from("ai_usage").select("*").eq("workspace_id", workspaceId),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    workspaceId,
    data: {
      workspace: workspaceRes.data ?? null,
      apps: appsRes.data ?? [],
      reviews: reviewsRes.data ?? [],
      templates: templatesRes.data ?? [],
      knowledgeBase: knowledgeBaseRes.data ?? [],
      alertPreferences: alertPreferencesRes.data ?? [],
      automationRules: automationRulesRes.data ?? [],
      aiUsage: aiUsageRes.data ?? [],
    },
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="revi-data-export.json"`,
    },
  });
}
