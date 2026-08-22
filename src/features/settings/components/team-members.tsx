"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Clock,
  Mail,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/api-error-message";
import { avatarInitials } from "@/utils/format";
import { avatarColorVar } from "@/lib/avatar-color";
import { LoadErrorState } from "@/components/load-error-state";

interface Member {
  clerk_user_id: string;
  role: string;
  joined_at: string | null;
  /** All three are null when Clerk could not be reached — see the members route. */
  name: string | null;
  email: string | null;
  image_url: string | null;
  is_self: boolean;
}

/**
 * Who this row is, in the order a human would recognise them: their name, then
 * the address they were invited at, and only as a last resort the Clerk ID —
 * which is what the row used to show for everyone.
 */
function memberLabel(m: Member): { primary: string; secondary: string | null } {
  if (m.name)  return { primary: m.name, secondary: m.email };
  if (m.email) return { primary: m.email, secondary: null };
  return { primary: `${m.clerk_user_id.slice(0, 12)}…`, secondary: "Name unavailable" };
}

interface Invite {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    owner: "bg-[var(--rb-purple-500)]/12 text-[var(--rb-purple-500)]",
    admin: "bg-[#0A84FF]/10 text-[#0A84FF]",
    member: "bg-[var(--rb-bg-sunken)] text-fg-3",
  };
  const cls = map[role] ?? map.member;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${cls}`}>
      {role}
    </span>
  );
}

export function TeamMembers() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole]   = useState<"member" | "admin">("member");
  const [err, setErr]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /**
   * `res.json()` is not a success check.
   *
   * These routes answer a 500 with a JSON error envelope, so the promise
   * RESOLVES and React Query caches the envelope **as data**. `data.members`
   * is then undefined, `?? []` makes it an empty array, the members block is
   * hidden by its own `length > 0` guard, and the screen reads "you are the
   * only person here" — on an admin page, about who has access. The invite
   * mutation twenty lines below has always checked `res.ok`; only the reads
   * did not. That asymmetry is the same one AU4 found in Reply Kit.
   *
   * Throwing is what makes React Query's `isError` reachable at all.
   */
  const {
    data: membersData,
    isError: membersFailed,
    isFetching: membersFetching,
    refetch: refetchMembers,
  } = useQuery<{ members: Member[] }>({
    queryKey: ["team-members"],
    queryFn: async () => {
      const r = await fetch("/api/team/members");
      if (!r.ok) throw new Error(`team members load failed: ${r.status}`);
      return r.json();
    },
  });

  const {
    data: invitesData,
    isError: invitesFailed,
    isFetching: invitesFetching,
    refetch: refetchInvites,
  } = useQuery<{ invites: Invite[] }>({
    queryKey: ["team-invites"],
    queryFn: async () => {
      const r = await fetch("/api/team/invites");
      if (!r.ok) throw new Error(`team invites load failed: ${r.status}`);
      return r.json();
    },
  });

  const loadFailed = membersFailed || invitesFailed;

  const invite = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string; detail?: string };
        throw new Error(apiErrorMessage(d, "Failed to send invite"));
      }
    },
    onSuccess: () => {
      setEmail("");
      setErr(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      void qc.invalidateQueries({ queryKey: ["team-invites"] });
    },
    onError: (e: Error) => {
      setErr(e.message);
    },
  });

  const members = membersData?.members ?? [];
  const invites = invitesData?.invites ?? [];

  return (
    <div className="rounded-xl border border-[var(--rb-border-1)] bg-surface p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="size-4 text-fg-3" strokeWidth={1.5} />
        <h2 className="text-[14px] font-semibold text-fg-1">Team members</h2>
      </div>

      {/* A failed read is shown as a failure. Rendering the invite form below it
          is deliberate — inviting someone still works when the roster read is
          down, and hiding the whole card would take that away for no reason. */}
      {loadFailed && (
        <div className="mb-4 rounded-lg border border-[var(--rb-border-1)]">
          <LoadErrorState
            subject={membersFailed ? "your team" : "your pending invites"}
            onRetry={() => {
              if (membersFailed) void refetchMembers();
              if (invitesFailed) void refetchInvites();
            }}
            retrying={membersFetching || invitesFetching}
            compact
          />
        </div>
      )}

      {/* Current members */}
      {!loadFailed && members.length > 0 && (
        <div className="mb-4 space-y-1">
          {members.map((m) => {
            const { primary, secondary } = memberLabel(m);
            return (
              <div key={m.clerk_user_id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-[var(--rb-bg-hover)]">
                <div className="flex min-w-0 items-center gap-2.5">
                  {m.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Clerk CDN avatar, no loader configured for it
                    <img
                      src={m.image_url}
                      alt=""
                      className="size-7 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                      style={{ background: avatarColorVar(m.clerk_user_id) }}
                    >
                      {avatarInitials(primary)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-fg-1">
                      {primary}
                      {m.is_self && <span className="ml-1.5 text-[11px] font-normal text-fg-3">You</span>}
                    </p>
                    {secondary && <p className="truncate text-[11px] text-fg-3">{secondary}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <RoleBadge role={m.role} />
                  <span className="text-[11px] text-fg-3">{formatDate(m.joined_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending invites */}
      {!loadFailed && invites.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-3">Pending invites</p>
          <div className="space-y-1">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--rb-border-1)] px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="size-3.5 shrink-0 text-fg-3" strokeWidth={1.5} />
                  <span className="text-[13px] text-fg-2 truncate">{inv.email}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <RoleBadge role={inv.role} />
                  <div className="flex items-center gap-1 text-[11px] text-fg-3">
                    <Clock className="size-3" strokeWidth={1.5} />
                    <span>Expires {formatDate(inv.expires_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite form */}
      <div className="border-t border-[var(--rb-border-1)] pt-4">
        <p className="mb-2 text-[12px] font-semibold text-fg-2">Invite a teammate</p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && email.trim()) invite.mutate(); }}
            className="h-8 flex-1 text-[13px]"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "member" | "admin")}
            className="h-8 rounded-md border border-[var(--rb-border-2)] bg-surface px-2 text-[12px] text-fg-2 outline-none"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button
            size="sm"
            disabled={!email.trim() || invite.isPending}
            onClick={() => invite.mutate()}
            className="h-8 gap-1.5 text-[12px] disabled:bg-[var(--rb-bg-sunken)] disabled:text-fg-3 disabled:opacity-100"
          >
            <UserPlus className="size-3.5" strokeWidth={1.5} />
            {invite.isPending ? "Sending…" : "Send invite"}
          </Button>
        </div>
        {err && <p className="mt-1.5 text-[12px] text-[var(--rb-red-500)]">{err}</p>}
        {success && <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--rb-green-500)]"><Check className="size-3.5" strokeWidth={3} />Invite sent</p>}
      </div>
    </div>
  );
}
