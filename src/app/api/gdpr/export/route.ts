import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getServiceClient, getWorkspaceId, getWorkspaceRole } from "@/lib/supabase-server";
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

    // Only the owner may export the whole workspace. A full export is every
    // tenant's data in one file; an invited member should not be able to walk
    // away with it. Mirrors the owner gate in /api/gdpr/delete.
    const role = await getWorkspaceRole(userId, workspaceId);
    if (role !== "owner") {
      return apiError("FORBIDDEN", 403, "Only the workspace owner can export workspace data.");
    }

    const sb = getServiceClient();

    // Columns are listed explicitly rather than "*" because apps.access_token
    // and apps.refresh_token hold live store credentials — for App Store
    // Connect that is the .p8 signing key and its keyId/issuerId. Exporting
    // them hands over the ability to post replies as the customer, forever,
    // outside ReviewBox. /api/debug/sync-status already excludes them.
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
      incidentsRes,
      invitesRes,
      ticketsRes,
      ticketMessagesRes,
    ] = await Promise.all([
      sb.from("workspaces").select("*").eq("id", workspaceId).single(),
      sb.from("workspace_members").select("*").eq("workspace_id", workspaceId),
      sb
        .from("apps")
        .select(
          "id, workspace_id, name, platform, store_id, icon_url, token_expires_at, last_synced_at, created_at",
        )
        .eq("workspace_id", workspaceId),
      sb.from("reviews").select("*").eq("workspace_id", workspaceId).limit(50000),
      sb.from("reply_templates").select("*").eq("workspace_id", workspaceId),
      sb.from("knowledge_base").select("*").eq("workspace_id", workspaceId),
      sb.from("alert_preferences").select("*").eq("workspace_id", workspaceId),
      sb.from("automation_rules").select("*").eq("workspace_id", workspaceId),
      sb.from("ai_usage").select("*").eq("workspace_id", workspaceId).limit(50000),
      sb.from("audit_log").select("*").eq("workspace_id", workspaceId).limit(50000),
      // Four tables were missing from the export. A subject-access request has
      // to return everything held about the person, and these hold plenty:
      // `workspace_invites` stores the email addresses of people who were
      // invited, and `support_tickets` stores the requester's email, name and
      // the full text of what they wrote to us.
      sb.from("incidents").select("*").eq("workspace_id", workspaceId).limit(50000),
      sb.from("workspace_invites").select("*").eq("workspace_id", workspaceId),
      sb.from("support_tickets").select("*").eq("workspace_id", workspaceId),
      // Messages hang off tickets, not off the workspace, so they need the
      // ticket ids rather than a workspace filter.
      sb.from("support_tickets").select("id").eq("workspace_id", workspaceId),
    ]);

    // Second hop for ticket message bodies — the customer's own words are the
    // part of a support thread they are most entitled to receive back.
    const ticketIds = ((ticketMessagesRes.data ?? []) as { id: string }[]).map((t) => t.id);
    const messagesRes = ticketIds.length
      ? await sb.from("support_ticket_messages").select("*").in("ticket_id", ticketIds).limit(50000)
      : { data: [] as unknown[] };

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
        incidents:         incidentsRes.data ?? [],
        invites:           invitesRes.data ?? [],
        supportTickets:    ticketsRes.data ?? [],
        supportMessages:   messagesRes.data ?? [],
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
