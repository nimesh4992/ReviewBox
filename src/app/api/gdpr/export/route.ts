import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/api-rate-limit";
import { apiError, captureAndError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

async function handler(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", 401);
    }

    // 3 full exports per hour — payload can be MBs, don't let people loop on it.
    const rl = await rateLimit(req, userId, { bucket: "gdpr-export", limit: 3, window: "1 h" });
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", 429);
    }

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) {
      return apiError("NO_WORKSPACE", 404);
    }

    const sb = getServiceClient();

    const [
      workspaceRes,
      membersRes,
      appsRes,
      reviewsRes,
      templatesRes,
      knowledgeBaseRes,
      alertPreferencesRes,
      automationRulesRes,
      aiUsageRes,
      auditLogRes,
    ] = await Promise.all([
      sb.from("workspaces").select("*").eq("id", workspaceId).single(),
      sb.from("workspace_members").select("*").eq("workspace_id", workspaceId),
      sb.from("apps").select("*").eq("workspace_id", workspaceId),
      sb.from("reviews").select("*").eq("workspace_id", workspaceId).limit(50000),
      sb.from("reply_templates").select("*").eq("workspace_id", workspaceId),
      sb.from("knowledge_base").select("*").eq("workspace_id", workspaceId),
      sb.from("alert_preferences").select("*").eq("workspace_id", workspaceId),
      sb.from("automation_rules").select("*").eq("workspace_id", workspaceId),
      sb.from("ai_usage").select("*").eq("workspace_id", workspaceId).limit(50000),
      sb.from("audit_log").select("*").eq("workspace_id", workspaceId).limit(50000),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      requestedBy: userId,
      workspaceId,
      data: {
        workspace:         workspaceRes.data ?? null,
        members:           membersRes.data ?? [],
        apps:              appsRes.data ?? [],
        reviews:           reviewsRes.data ?? [],
        templates:         templatesRes.data ?? [],
        knowledgeBase:     knowledgeBaseRes.data ?? [],
        alertPreferences:  alertPreferencesRes.data ?? [],
        automationRules:   automationRulesRes.data ?? [],
        aiUsage:           aiUsageRes.data ?? [],
        auditLog:          auditLogRes.data ?? [],
      },
    };

    await audit({
      workspaceId,
      actorUserId: userId,
      action: "gdpr.export",
      targetType: "workspace",
      targetId: workspaceId,
      payload: { event: "gdpr_export", rowCounts: countRows(payload.data) },
      request: req,
    });

    const filename = `reviewbox-export-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return captureAndError(err, "POST /api/gdpr/export");
  }
}

function countRows(data: Record<string, unknown>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    counts[key] = Array.isArray(value) ? value.length : value ? 1 : 0;
  }
  return counts;
}

// POST only — GET on a data-export route is a CSRF vector (triggerable via
// img src, link prefetch, browser history preload). The UI already uses POST.
export const POST = handler;
