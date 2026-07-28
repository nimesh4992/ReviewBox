import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

import { requireAdminUser } from "@/lib/admin-auth";
import { apiError, captureAndError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import { getServiceClient } from "@/lib/supabase-server";
import { isMissingTableError, parseTicketMessageInput } from "@/lib/support-tickets";

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/tickets/[id]/messages — append an admin reply or internal
 * note to a ticket thread. Admin-only.
 *
 * NOTE (D009 #6): nothing is emailed to the customer. The reply is stored in
 * the thread; the founder sends the actual email from hello@tryreviewbox.com.
 * A public reply on an open ticket flips it to "pending" (waiting on the
 * customer); internal notes never change status.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminId = await requireAdminUser();
    if (!adminId) return apiError("FORBIDDEN", 403);

    const { id } = await params;
    if (!UUID_SHAPE.test(id)) return apiError("INVALID_INPUT", 400, "Invalid ticket id.");

    const parsed = parseTicketMessageInput(await request.json().catch(() => null));
    if (!parsed.ok) return apiError("INVALID_INPUT", 400, parsed.message);

    const sb = getServiceClient();
    const { data: ticket, error: ticketError } = await sb
      .from("support_tickets")
      .select("id, workspace_id, status")
      .eq("id", id)
      .maybeSingle();

    if (ticketError) {
      if (isMissingTableError(ticketError)) {
        return apiError("SERVICE_UNAVAILABLE", 503, "Run supabase/migrations/017_support_tickets.sql first.");
      }
      return captureAndError(ticketError, "admin/tickets:message");
    }
    if (!ticket) return apiError("NOT_FOUND", 404, "Ticket not found.");

    const user = await currentUser();
    const authorName =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || "ReviewBox team";

    const { data: message, error: messageError } = await sb
      .from("support_ticket_messages")
      .insert({
        ticket_id: id,
        author_type: "admin",
        author_name: authorName,
        body: parsed.value.body,
        is_internal: parsed.value.isInternal,
      })
      .select("id")
      .single();

    if (messageError || !message) {
      return captureAndError(messageError, "admin/tickets:message-insert");
    }

    const ticketPatch: Record<string, unknown> = { last_message_at: new Date().toISOString() };
    if (!parsed.value.isInternal && ticket.status === "open") {
      ticketPatch.status = "pending";
    }
    const { error: patchError } = await sb
      .from("support_tickets")
      .update(ticketPatch)
      .eq("id", id);
    if (patchError) console.error("[admin/tickets] last_message_at update failed:", patchError);

    await audit({
      workspaceId: (ticket.workspace_id as string | null) ?? null,
      actorUserId: adminId,
      action: "ticket.message",
      targetType: "ticket",
      targetId: id,
      payload: { isInternal: parsed.value.isInternal },
      request,
    });

    return NextResponse.json({ messageId: message.id }, { status: 201 });
  } catch (err) {
    return captureAndError(err, "admin/tickets:message");
  }
}
