import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

import { requireAdminUser } from "@/lib/admin-auth";
import { apiError, captureAndError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { isMissingTableError, parseManualTicketInput } from "@/lib/support-tickets";

/**
 * POST /api/admin/tickets — founder logs a ticket that arrived outside the
 * app (usually an email to hello@tryreviewbox.com), so all support lives in
 * one queue. Admin-only.
 */
export async function POST(request: NextRequest) {
  try {
    const adminId = await requireAdminUser();
    if (!adminId) return apiError("FORBIDDEN", 403);

    const parsed = parseManualTicketInput(await request.json().catch(() => null));
    if (!parsed.ok) return apiError("INVALID_INPUT", 400, parsed.message);
    const input = parsed.value;

    const sb = getServiceClient();

    // Best-effort workspace linkage: resolve the requester email to a Clerk
    // user, then to their workspace, so the ticket lands on the right
    // customer automatically. Unknown emails stay unlinked — that's fine.
    let workspaceId: string | null = null;
    try {
      const clerk = await clerkClient();
      const { data: users } = await clerk.users.getUserList({
        emailAddress: [input.requesterEmail],
        limit: 1,
      });
      const clerkUserId = users[0]?.id;
      if (clerkUserId) workspaceId = await getWorkspaceId(clerkUserId);
    } catch (err) {
      console.error("[admin/tickets] workspace linkage lookup failed:", err);
    }

    const { data: ticket, error } = await sb
      .from("support_tickets")
      .insert({
        workspace_id: workspaceId,
        requester_email: input.requesterEmail,
        requester_name: input.requesterName,
        subject: input.subject,
        priority: input.priority,
        source: input.source,
      })
      .select("id")
      .single();

    if (error || !ticket) {
      if (isMissingTableError(error)) {
        return apiError("SERVICE_UNAVAILABLE", 503, "Run supabase/migrations/017_support_tickets.sql first.");
      }
      return captureAndError(error, "admin/tickets:create");
    }

    const { error: messageError } = await sb.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      author_type: "customer",
      author_name: input.requesterName ?? input.requesterEmail,
      body: input.body,
    });
    if (messageError) return captureAndError(messageError, "admin/tickets:first-message");

    await audit({
      workspaceId,
      actorUserId: adminId,
      action: "ticket.create",
      targetType: "ticket",
      targetId: ticket.id as string,
      payload: { subject: input.subject, source: input.source },
      request,
    });

    return NextResponse.json({ ticketId: ticket.id }, { status: 201 });
  } catch (err) {
    return captureAndError(err, "admin/tickets");
  }
}
