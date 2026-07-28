import Link from "next/link";

import { cn } from "@/lib/utils";
import { isMissingTableError, mapTicketRow, TICKET_STATUSES } from "@/lib/support-tickets";
import { getServiceClient } from "@/lib/supabase-server";
import type { SupportTicket, SupportTicketStatus } from "@/types/review";

const STATUS_BADGE: Record<SupportTicketStatus, string> = {
  open:     "bg-blue-50 text-blue-600 border border-blue-200",
  pending:  "bg-amber-50 text-amber-700 border border-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  closed:   "bg-gray-100 text-gray-500 border border-gray-200",
};

const PRIORITY_TEXT: Record<string, string> = {
  urgent: "text-red-600 font-medium",
  high:   "text-amber-600",
  normal: "text-gray-500",
  low:    "text-gray-400",
};

const SOURCE_LABEL: Record<string, string> = {
  in_app: "In-app",
  email:  "Email",
  manual: "Manual",
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeFilter = (TICKET_STATUSES as string[]).includes(status ?? "")
    ? (status as SupportTicketStatus)
    : null;

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("support_tickets")
    .select("*, workspaces(name)")
    .order("last_message_at", { ascending: false })
    .limit(200);

  if (error && isMissingTableError(error)) {
    return (
      <div>
        <h1 className="mb-6 text-lg font-semibold text-gray-900">Tickets</h1>
        <div className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-medium text-amber-800">One-time setup needed</p>
          <p className="mt-1 text-sm text-amber-700">
            Paste{" "}
            <code className="rounded bg-white px-1 py-0.5 text-xs">supabase/migrations/017_support_tickets.sql</code>{" "}
            into the Supabase SQL editor and run it (safe to run twice). This page switches on by
            itself afterwards — nothing else to configure.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="mb-6 text-lg font-semibold text-gray-900">Tickets</h1>
        <p className="text-sm text-red-500">Failed to load tickets: {error.message}</p>
      </div>
    );
  }

  const all: SupportTicket[] = (data ?? []).map((row) => mapTicketRow(row as Record<string, unknown>));
  const tickets = activeFilter ? all.filter((t) => t.status === activeFilter) : all;
  const countFor = (s: SupportTicketStatus) => all.filter((t) => t.status === s).length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">
          Tickets
          <span className="ml-2 text-sm font-normal text-gray-400">({tickets.length})</span>
        </h1>
        <Link
          href="/admin/tickets/new"
          className="h-8 rounded-lg bg-gray-900 px-4 text-sm font-medium leading-8 text-white hover:bg-gray-700"
        >
          Log ticket
        </Link>
      </div>

      {/* Status filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link
          href="/admin/tickets"
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            !activeFilter ? "bg-gray-900 text-white" : "bg-white text-gray-500 border border-gray-200 hover:text-gray-700",
          )}
        >
          All ({all.length})
        </Link>
        {TICKET_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/tickets?status=${s}`}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium capitalize",
              activeFilter === s
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-500 border border-gray-200 hover:text-gray-700",
            )}
          >
            {s} ({countFor(s)})
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Ticket</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Workspace</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Source</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Priority</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Last activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  {activeFilter ? `No ${activeFilter} tickets.` : "No tickets yet. Customers can file them from Settings → Contact support."}
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/tickets/${t.id}`} className="font-medium text-gray-900 hover:underline">
                      {t.subject}
                    </Link>
                    <p className="text-xs text-gray-400">
                      {t.requesterName ?? t.requesterEmail}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{t.workspaceName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{SOURCE_LABEL[t.source] ?? t.source}</td>
                  <td className={cn("px-4 py-3 capitalize", PRIORITY_TEXT[t.priority] ?? "text-gray-500")}>
                    {t.priority}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                        STATUS_BADGE[t.status],
                      )}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">{relativeTime(t.lastMessageAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
