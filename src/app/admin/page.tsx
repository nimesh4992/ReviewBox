import Link from "next/link";

import { StatCard } from "@/features/admin/components/stat-card";
import { isMissingTableError, mapTicketRow } from "@/lib/support-tickets";
import { getServiceClient } from "@/lib/supabase-server";
import type { SupportTicket } from "@/types/review";
import { requireAdminPage } from "@/lib/admin-auth";

// Displayed revenue is an estimate from the D002 list prices — Stripe stays
// untouched until the founder wires it (D013). Change prices there, not here.
const PLAN_LIST_PRICES: Record<string, number> = { starter: 49, pro: 99, team: 199 };

interface WorkspaceLite {
  id: string;
  name: string;
  plan: string | null;
  created_at: string;
  deleted_at: string | null;
}

export default async function AdminOverviewPage() {
  await requireAdminPage();
  const sb = getServiceClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

  const [workspacesRes, appsRes, reviewsRes, reviews7dRes, aiDrafts7dRes, ticketsRes] =
    await Promise.all([
      sb.from("workspaces").select("id, name, plan, created_at, deleted_at").order("created_at", { ascending: false }),
      sb.from("apps").select("id", { count: "exact", head: true }),
      sb.from("reviews").select("id", { count: "exact", head: true }),
      sb.from("reviews").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      sb.from("ai_usage").select("id", { count: "exact", head: true }).eq("action", "draft_reply").gte("created_at", sevenDaysAgo),
      sb
        .from("support_tickets")
        .select("*, workspaces(name)")
        .in("status", ["open", "pending"])
        .order("last_message_at", { ascending: false })
        .limit(5),
    ]);

  const workspaces = (workspacesRes.data ?? []) as WorkspaceLite[];
  const active = workspaces.filter((w) => !w.deleted_at);
  const deletedCount = workspaces.length - active.length;
  const signups7d = active.filter((w) => w.created_at >= sevenDaysAgo).length;

  const planCounts: Record<string, number> = {};
  for (const w of active) {
    const plan = w.plan ?? "trial";
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;
  }
  const planBreakdown =
    Object.entries(planCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([plan, count]) => `${count} ${plan}`)
      .join(", ") || "—";

  const payingCount = active.filter((w) => (w.plan ?? "") in PLAN_LIST_PRICES).length;
  const estMrr = active.reduce((sum, w) => sum + (PLAN_LIST_PRICES[w.plan ?? ""] ?? 0), 0);

  // Tickets degrade gracefully until migration 017 is applied.
  const ticketsMissing = isMissingTableError(ticketsRes.error);
  const openTickets: SupportTicket[] = ticketsRes.error
    ? []
    : (ticketsRes.data ?? []).map((row) => mapTicketRow(row as Record<string, unknown>));

  const recentSignups = active.slice(0, 5);

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-gray-900">Overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Active workspaces"
          value={active.length}
          sub={deletedCount > 0 ? `${planBreakdown} · ${deletedCount} deleted` : planBreakdown}
        />
        <StatCard label="Signups, last 7 days" value={signups7d} />
        <StatCard
          label="Est. MRR (list price)"
          value={`$${estMrr.toLocaleString()}`}
          sub={`${payingCount} paying · Stripe not wired (D013)`}
        />
        <StatCard label="Apps connected" value={appsRes.count ?? 0} />
        <StatCard
          label="Reviews synced"
          value={(reviewsRes.count ?? 0).toLocaleString()}
          sub={`+${(reviews7dRes.count ?? 0).toLocaleString()} in the last 7 days`}
        />
        <StatCard
          label="AI drafts, last 7 days"
          value={aiDrafts7dRes.count ?? 0}
          sub={ticketsMissing ? "Tickets: run migration 017" : `${openTickets.length} open ticket${openTickets.length === 1 ? "" : "s"} shown below`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Recent signups */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent signups</h2>
            <Link href="/admin/customers" className="text-xs text-gray-400 hover:text-gray-600">
              All customers →
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {recentSignups.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-gray-400">No signups yet.</td>
                  </tr>
                ) : (
                  recentSignups.map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/customers/${w.id}`} className="font-medium text-gray-900 hover:underline">
                          {w.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-500">{w.plan ?? "trial"}</td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        {new Date(w.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Open tickets */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Needs a reply</h2>
            <Link href="/admin/tickets" className="text-xs text-gray-400 hover:text-gray-600">
              All tickets →
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {ticketsMissing ? (
              <p className="px-4 py-6 text-sm text-gray-400">
                Ticket tables aren&apos;t provisioned yet — paste{" "}
                <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">supabase/migrations/017_support_tickets.sql</code>{" "}
                into the Supabase SQL editor.
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {openTickets.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-gray-400">
                        No open tickets. Quiet inbox, happy customers.
                      </td>
                    </tr>
                  ) : (
                    openTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link href={`/admin/tickets/${t.id}`} className="font-medium text-gray-900 hover:underline">
                            {t.subject}
                          </Link>
                          <p className="text-xs text-gray-400">
                            {t.workspaceName ?? t.requesterEmail}
                          </p>
                        </td>
                        <td className="px-4 py-3 capitalize text-gray-500">{t.status}</td>
                        <td className="px-4 py-3 text-right capitalize text-gray-400">{t.priority}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
