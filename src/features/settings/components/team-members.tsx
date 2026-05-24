"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Mail, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Member {
  clerk_user_id: string;
  role: string;
  joined_at: string | null;
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
    owner: "bg-[var(--rb-purple-100)] text-[var(--rb-purple-600)]",
    admin: "bg-[var(--rb-blue-100)]   text-[var(--rb-blue-600)]",
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

  const { data: membersData } = useQuery<{ members: Member[] }>({
    queryKey: ["team-members"],
    queryFn: () => fetch("/api/team/members").then((r) => r.json()),
  });

  const { data: invitesData } = useQuery<{ invites: Invite[] }>({
    queryKey: ["team-invites"],
    queryFn: () => fetch("/api/team/invites").then((r) => r.json()),
  });

  const invite = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string; detail?: string };
        throw new Error(d.detail ?? d.error ?? "Failed to send invite");
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

      {/* Current members */}
      {members.length > 0 && (
        <div className="mb-4 space-y-1">
          {members.map((m) => (
            <div key={m.clerk_user_id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-[var(--rb-bg-hover)]">
              <span className="text-[13px] text-fg-2 font-mono truncate">{m.clerk_user_id.slice(0, 20)}…</span>
              <div className="flex items-center gap-2 shrink-0">
                <RoleBadge role={m.role} />
                <span className="text-[11px] text-fg-3">{formatDate(m.joined_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending invites */}
      {invites.length > 0 && (
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
            className="h-8 gap-1.5 text-[12px]"
          >
            <UserPlus className="size-3.5" strokeWidth={1.5} />
            {invite.isPending ? "Sending…" : "Send invite"}
          </Button>
        </div>
        {err && <p className="mt-1.5 text-[12px] text-[var(--rb-red-500)]">{err}</p>}
        {success && <p className="mt-1.5 text-[12px] text-[var(--rb-green-500)]">✓ Invite sent</p>}
      </div>
    </div>
  );
}
