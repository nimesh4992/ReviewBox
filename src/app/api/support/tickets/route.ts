import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { apiError, captureAndError } from "@/lib/api-response";
import { rateLimit } from "@/lib/api-rate-limit";
import { audit } from "@/lib/audit";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { isMissingTableError, parseTicketInput } from "@/lib/support-tickets";

/**
 * POST /api/support/tickets — customer files a support ticket from inside the
 * app (Settings → Contact support). Creates the ticket plus its first thread
 * message; the founder works it at /admin/tickets.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", 401);

    const limit = await rateLimit(request, userId, {
      bucket: "support-ticket-create",
      limit: 5,
      window: "1 h",
    });
    if (!limit.allowed) {
      return apiError("RATE_LIMITED", 429, "Too many tickets in the last hour. Email hello@tryreviewbox.com if it's urgent.");
    }

    const parsed = parseTicketInput(await request.json().catch(() => null));
    if (!parsed.ok) return apiError("INVALID_INPUT", 400, parsed.message);

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress ?? null;
    if (!email) {
      return apiError("INVALID_INPUT", 400, "Your account has no email address — email hello@tryreviewbox.com instead.");
    }
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || null;

    const workspaceId = await getWorkspaceId(userId);
    const sb = getServiceClient();

    const { data: ticket, error } = await sb
      .from("support_tickets")
      .insert({
        workspace_id: workspaceId,
        requester_clerk_id: userId,
        requester_email: email,
        requester_name: name,
        subject: parsed.value.subject,
        source: "in_app",
      })
      .select("id")
      .single();

    if (error || !ticket) {
      if (isMissingTableError(error)) {
        // Migration 017 not applied yet — degrade to the email channel.
        return apiError("SERVICE_UNAVAILABLE", 503, "The support inbox isn't live yet. Email hello@tryreviewbox.com and we'll pick it up there.");
      }
      return captureAndError(error, "support/tickets:create");
    }

    const { error: messageError } = await sb.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      author_type: "customer",
      author_name: name ?? email,
      body: parsed.value.body,
    });
    if (messageError) return captureAndError(messageError, "support/tickets:first-message");

    await audit({
      workspaceId,
      actorUserId: userId,
      action: "ticket.create",
      targetType: "ticket",
      targetId: ticket.id as string,
      payload: { subject: parsed.value.subject, source: "in_app" },
      request,
    });

    return NextResponse.json({ ticketId: ticket.id }, { status: 201 });
  } catch (err) {
    return captureAndError(err, "support/tickets");
  }
}
