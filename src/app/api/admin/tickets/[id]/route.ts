import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/admin-auth";
import { apiError, captureAndError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import { getServiceClient } from "@/lib/supabase-server";
import { isMissingTableError, parseTicketUpdate } from "@/lib/support-tickets";

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/admin/tickets/[id] — change a ticket's status and/or priority.
 * Admin-only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminId = await requireAdminUser();
    if (!adminId) return apiError("FORBIDDEN", 403);

    const { id } = await params;
    if (!UUID_SHAPE.test(id)) return apiError("INVALID_INPUT", 400, "Invalid ticket id.");

    const parsed = parseTicketUpdate(await request.json().catch(() => null));
    if (!parsed.ok) return apiError("INVALID_INPUT", 400, parsed.message);

    const sb = getServiceClient();
    const { data, error } = await sb
      .from("support_tickets")
      .update(parsed.value)
      .eq("id", id)
      .select("id, workspace_id")
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) {
        return apiError("SERVICE_UNAVAILABLE", 503, "Run supabase/migrations/017_support_tickets.sql first.");
      }
      return captureAndError(error, "admin/tickets:update");
    }
    if (!data) return apiError("NOT_FOUND", 404, "Ticket not found.");

    await audit({
      workspaceId: (data.workspace_id as string | null) ?? null,
      actorUserId: adminId,
      action: "ticket.update",
      targetType: "ticket",
      targetId: id,
      payload: { ...parsed.value },
      request,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return captureAndError(err, "admin/tickets:update");
  }
}
