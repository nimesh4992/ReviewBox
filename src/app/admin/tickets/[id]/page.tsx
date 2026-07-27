import Link from "next/link";
import { notFound } from "next/navigation";

import { TicketControls } from "@/features/admin/components/ticket-controls";
import { TicketReplyForm } from "@/features/admin/components/ticket-reply-form";
import { cn } from "@/lib/utils";
import { isMissingTableError, mapTicketMessageRow, mapTicketRow } from "@/lib/support-tickets";
import { getServiceClient } from "@/lib/supabase-server";

const SOURCE_LABEL: Record<string, string> = {
  in_app: "Filed in-app",
  email:  "Arrived by email",
  manual: "Logged manually",
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = getServiceClient();

  const { data: ticketRow, error } = await sb
    .from("support_tickets")
    .select("*, workspaces(name)")
    .eq("id", id)
    .maybeSingle();

  if (error && isMissingTableError(error)) {
    return (
      <div>
        <Link href="/admin/tickets" className="text-xs text-gray-400 hover:text-gray-600">← Tickets</Link>
        <p className="mt-4 text-sm text-amber-700">
          Run <code className="rounded bg-amber-50 px-1 py-0.5 text-xs">supabase/migrations/017_support_tickets.sql</code> first.
        </p>
      </div>
    );
  }
  if (error || !ticketRow) notFound();

  const ticket = mapTicketRow(ticketRow as Record<string, unknown>);

  const { data: messageRows } = await sb
    .from("support_ticket_messages")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });
  const messages = (messageRows ?? []).map((row) => mapTicketMessageRow(row as Record<string, unknown>));

  return (
    <div className="max-w-3xl">
      <Link href="/admin/tickets" className="text-xs text-gray-400 hover:text-gray-600">← Tickets</Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{ticket.subject}</h1>
          <p className="mt-1 text-xs text-gray-400">
            {ticket.requesterName ? `${ticket.requesterName} · ` : ""}
            {ticket.requesterEmail}
            {" · "}
            {SOURCE_LABEL[ticket.source] ?? ticket.source}
            {" · "}
            {formatTimestamp(ticket.createdAt)}
            {ticket.workspaceId && (
              <>
                {" · "}
                <Link href={`/admin/customers/${ticket.workspaceId}`} className="text-gray-500 hover:underline">
                  {ticket.workspaceName ?? "Workspace"}
                </Link>
              </>
            )}
          </p>
        </div>
        <TicketControls ticketId={ticket.id} status={ticket.status} priority={ticket.priority} />
      </div>

      {/* Thread */}
      <div className="mt-6 space-y-3">
        {messages.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-400">
            No messages on this ticket.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-xl border p-4 shadow-sm",
                m.isInternal
                  ? "border-amber-200 bg-amber-50"
                  : m.authorType === "admin"
                    ? "border-blue-100 bg-blue-50/60"
                    : "border-gray-200 bg-white",
              )}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-gray-700">
                  {m.authorName ?? (m.authorType === "admin" ? "ReviewBox team" : "Customer")}
                  {m.isInternal && (
                    <span className="ml-2 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      Internal note
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-gray-400">{formatTimestamp(m.createdAt)}</p>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{m.body}</p>
            </div>
          ))
        )}
      </div>

      {/* Reply box */}
      <div className="mt-6">
        <TicketReplyForm ticketId={ticket.id} />
      </div>
    </div>
  );
}
