import Link from "next/link";
import { notFound } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";

import { StatCard } from "@/features/admin/components/stat-card";
import { isMissingTableError, mapTicketRow } from "@/lib/support-tickets";
import { getServiceClient } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";
import type { SupportTicket } from "@/types/review";

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface MemberRow {
  clerk_user_id: string;
  role: string;
  created_at: string;
  email: string | null;
  name: string | null;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

async function resolveMembers(
  rows: { clerk_user_id: string; role: string; created_at: string }[],
): Promise<MemberRow[]> {
  const base: MemberRow[] = rows.map((r) => ({ ...r, email: null, name: null }));
  if (!rows.length) return base;
  try {
    const clerk = await clerkClient();
    const { data: users } = await clerk.users.getUserList({
      userId: rows.map((r) => r.clerk_user_id),
      limit: rows.length,
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return base.map((m) => {
      const u = byId.get(m.clerk_user_id);
      return {
        ...m,
        email: u?.emailAddresses[0]?.emailAddress ?? null,
        name: [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() || null,
      };
    });
  } catch (err) {
    console.error("[admin/customers] Clerk lookup failed:", err);
    return base;
  }
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_SHAPE.test(id)) notFound();

  const sb = getServiceClient();
  const { data: workspace } = await sb
    .from("workspaces")
    .select("id, name, slug, plan, created_at, deleted_at, trial_ends_at, stripe_customer_id, stripe_subscription_id")
    .eq("id", id)
    .maybeSingle();
  if (!workspace) notFound();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

  const [membersRes, appsFullRes, reviewsRes, needsReplyRes, aiRes, ticketsRes, auditRes] =
    await Promise.all([
      sb.from("workspace_members").select("clerk_user_id, role, created_at").eq("workspace_id", id).order("created_at"),
      sb
        .from("apps")
        .select("id, name, platform, store_id, last_synced_at, last_sync_status, lifetime_rating, deleted_at")
        .eq("workspace_id", id)
        .order("created_at"),
      sb.from("reviews").select("id", { count: "exact", head: true }).eq("workspace_id", id),
      sb.from("reviews").select("id", { count: "exact", head: true }).eq("workspace_id", id).eq("reply_status", "needs_reply"),
      sb.from("ai_usage").select("id", { count: "exact", head: true }).eq("workspace_id", id).gte("created_at", thirtyDaysAgo),
      sb.from("support_tickets").select("*").eq("workspace_id", id).order("last_message_at", { ascending: false }).limit(10),
      sb.from("audit_log").select("action, actor_user_id, created_at").eq("workspace_id", id).order("created_at", { ascending: false }).limit(8),
    ]);

  // Sync-metadata columns arrived in later migrations; retry without them.
  let apps = (appsFullRes.data ?? []) as Record<string, unknown>[];
  if (appsFullRes.error?.code === "42703") {
    const minimal = await sb
      .from("apps")
      .select("id, name, platform, store_id, last_synced_at")
      .eq("workspace_id", id)
      .order("created_at");
    apps = (minimal.data ?? []) as Record<string, unknown>[];
  }

  const members = await resolveMembers(
    (membersRes.data ?? []) as { clerk_user_id: string; role: string; created_at: string }[],
  );

  const ticketsMissing = isMissingTableError(ticketsRes.error);
  const tickets: SupportTicket[] = ticketsRes.error
    ? []
    : (ticketsRes.data ?? []).map((row) => mapTicketRow(row as Record<string, unknown>));

  const auditEvents = (auditRes.data ?? []) as { action: string; actor_user_id: string | null; created_at: string }[];

  return (
    <div className="max-w-4xl">
      <Link href="/admin/customers" className="text-xs text-gray-400 hover:text-gray-600">← Customers</Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-gray-900">{workspace.name}</h1>
        <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium capitalize text-gray-600">
          {(workspace.plan as string | null)?.replace("_", " ") ?? "trial"}
        </span>
        {workspace.deleted_at && (
          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
            deleted {formatDate(workspace.deleted_at as string)}
          </span>
        )}
        <span className="text-xs text-gray-400">/{workspace.slug}</span>
      </div>

      <p className="mt-1 text-xs text-gray-400">
        Joined {formatDate(workspace.created_at as string)}
        {workspace.plan === "trial" && ` · Trial ends ${formatDate(workspace.trial_ends_at as string | null)}`}
        {workspace.stripe_customer_id ? ` · Stripe ${workspace.stripe_customer_id}` : " · No Stripe customer"}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Apps" value={apps.filter((a) => !a.deleted_at).length} />
        <StatCard label="Reviews synced" value={(reviewsRes.count ?? 0).toLocaleString()} />
        <StatCard label="Needs reply" value={needsReplyRes.count ?? 0} />
        <StatCard label="AI calls, 30 days" value={aiRes.count ?? 0} />
      </div>

      {/* Members */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Members</h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {members.map((m) => (
                <tr key={m.clerk_user_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{m.name ?? m.email ?? "Unknown user"}</p>
                    <p className="text-xs text-gray-400">{m.email ?? m.clerk_user_id}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-500">{m.role}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{formatDate(m.created_at)}</td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-gray-400">No members.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Apps */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Apps</h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500">App</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Platform</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Rating</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Last synced</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Sync status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {apps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">
                    No apps connected.
                  </td>
                </tr>
              ) : (
                apps.map((a) => (
                  <tr key={a.id as string} className={cn("hover:bg-gray-50", a.deleted_at ? "opacity-50" : undefined)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {a.name as string}
                        {Boolean(a.deleted_at) && <span className="ml-2 text-[10px] text-red-500">removed</span>}
                      </p>
                      <p className="text-xs text-gray-400">{a.store_id as string}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {a.platform === "google_play" ? "Google Play" : "App Store"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {typeof a.lifetime_rating === "number" ? (a.lifetime_rating as number).toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {a.last_synced_at ? formatDate(a.last_synced_at as string) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{(a.last_sync_status as string | null) ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tickets */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Support tickets</h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {ticketsMissing ? (
            <p className="px-4 py-6 text-sm text-gray-400">
              Ticket tables not provisioned yet — run migration 017.
            </p>
          ) : tickets.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">No tickets from this workspace.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/tickets/${t.id}`} className="font-medium text-gray-900 hover:underline">
                        {t.subject}
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-500">{t.status}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{formatDate(t.lastMessageAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Recent activity */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Recent activity</h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {auditEvents.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">No audit events.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {auditEvents.map((e, i) => (
                  <tr key={`${e.created_at}-${i}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{e.action}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{e.actor_user_id ?? "system"}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-gray-400">{formatDate(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
