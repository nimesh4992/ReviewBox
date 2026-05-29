"use client";

import { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface VerifyResult {
  ok: boolean;
  message: string;
  verifiedAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** App ID + package name from the workspace (for verify call). */
  app?: { id: string; store_id: string; name: string };
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "invite", label: "Invite service account", sub: "Reply to reviews, get ratings data" },
  { id: "troubleshoot", label: "Troubleshoot", sub: "Fix common connection issues" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// ── Visual guide (right column) ────────────────────────────────────────────────

function PlayConsoleVisual() {
  return (
    <div className="h-full rounded-xl border border-gray-200 bg-[#F8F9FB] p-4 text-[11px]">
      {/* Mock Play Console header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="h-5 w-5 rounded-full bg-[#01875F]" />
        <span className="font-semibold text-gray-700 text-xs">Google Play Console</span>
      </div>
      {/* Mock nav item */}
      <div className="mb-2 flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-3 py-2 shadow-sm">
        <div className="h-3 w-3 rounded-sm bg-gray-300" />
        <span className="text-gray-600 font-medium">Users and permissions</span>
        <span className="ml-auto text-[#0A84FF] font-medium text-[10px]">← click here</span>
      </div>
      <div className="flex justify-center my-1.5 text-gray-400 font-bold text-base">↓</div>
      {/* Mock invite button */}
      <div className="mb-2 flex items-center justify-between rounded-lg bg-white border border-gray-200 px-3 py-2 shadow-sm">
        <span className="text-gray-600">Your team</span>
        <div className="flex items-center gap-1.5 rounded-full bg-[#01875F] px-2.5 py-0.5 text-[10px] text-white font-semibold">
          + Invite new users
        </div>
      </div>
      <div className="flex justify-center my-1.5 text-gray-400 font-bold text-base">↓</div>
      {/* Mock email field */}
      <div className="rounded-lg bg-white border border-gray-200 px-3 py-2.5 shadow-sm space-y-1.5">
        <div className="text-[10px] text-gray-400 font-medium">Email address</div>
        <div className="rounded border border-[#0A84FF] bg-blue-50 px-2 py-1 font-mono text-[10px] text-[#0A84FF] truncate">
          reviewbox@…gserviceaccount.com
        </div>
      </div>
      <div className="flex justify-center my-1.5 text-gray-400 font-bold text-base">↓</div>
      {/* Mock permissions */}
      <div className="rounded-lg bg-white border border-gray-200 px-3 py-2.5 shadow-sm space-y-1.5">
        <div className="text-[10px] text-gray-500 font-semibold">App permissions</div>
        {["View app information", "Reply to reviews"].map((p) => (
          <div key={p} className="flex items-center gap-1.5">
            <div className="flex h-3.5 w-3.5 items-center justify-center rounded bg-[#01875F]">
              <Check className="h-2.5 w-2.5 text-white" />
            </div>
            <span className="text-[10px] text-gray-600">{p}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-center my-1.5 text-gray-400 font-bold text-base">↓</div>
      {/* Mock send button */}
      <div className="flex justify-end">
        <div className="rounded-full bg-[#01875F] px-4 py-1.5 text-[10px] text-white font-semibold shadow-sm">
          Send invitation
        </div>
      </div>
    </div>
  );
}

// ── Invite tab ─────────────────────────────────────────────────────────────────

function InviteTab({
  email,
  verifyResult,
}: {
  email: string | null;
  verifyResult: VerifyResult | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  }

  const steps: React.ReactNode[] = [
    <>
      Open{" "}
      <a
        href="https://play.google.com/console"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-[#0A84FF] hover:underline"
      >
        play.google.com/console
      </a>
      {" "}→ <strong>Users and permissions</strong>
    </>,
    <>Click <strong>Invite new users</strong> (top right)</>,
    <>Paste the email below, then click <strong>Add</strong></>,
    <>
      Under <strong>App permissions</strong>, enable:
      <ul className="mt-1 ml-3 space-y-0.5">
        <li className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />
          <span>View app information &amp; download bulk reports</span>
        </li>
        <li className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />
          <span>Reply to reviews</span>
        </li>
      </ul>
    </>,
    <>Click <strong>Invite user → Send invitation</strong></>,
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_240px]">
      {/* Left: instructions */}
      <div className="space-y-5">
        {/* Warning box */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p className="text-[12px] text-amber-800 leading-relaxed">
            You need to be the <strong>owner</strong> of the Google Play developer account to complete this integration.
          </p>
        </div>

        {/* Email copy box */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Service account email — invite this address
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-[#F5F5F7] px-4 py-3">
            {email ? (
              <>
                <span className="flex-1 truncate font-mono text-[12px] text-gray-800 select-all">
                  {email}
                </span>
                <button
                  onClick={copyEmail}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {copied ? (
                    <><Check className="size-3.5 text-emerald-500" /> Copied</>
                  ) : (
                    <><Copy className="size-3.5" /> Copy</>
                  )}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-[12px] text-gray-400">
                <Loader2 className="size-3.5 animate-spin" />
                Loading service account email…
              </div>
            )}
          </div>
        </div>

        {/* Steps */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Steps
          </p>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0A84FF] text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-[13px] text-gray-600 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Verify result (inline) */}
        {verifyResult && (
          <div
            className={cn(
              "rounded-xl border px-4 py-3",
              verifyResult.ok
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50",
            )}
          >
            <div className={cn(
              "flex items-center gap-1.5 text-xs font-semibold",
              verifyResult.ok ? "text-emerald-700" : "text-red-700",
            )}>
              {verifyResult.ok
                ? <CheckCircle2 className="size-3.5" />
                : <TriangleAlert className="size-3.5" />}
              {verifyResult.ok ? "Connection verified!" : "Not connected yet"}
            </div>
            <p className={cn(
              "mt-1 text-[12px] leading-relaxed",
              verifyResult.ok ? "text-emerald-700/90" : "text-red-700/90",
            )}>
              {verifyResult.message}
            </p>
          </div>
        )}
      </div>

      {/* Right: visual guide */}
      <div className="hidden lg:block">
        <PlayConsoleVisual />
      </div>
    </div>
  );
}

// ── Troubleshoot tab ──────────────────────────────────────────────────────────

function TroubleshootTab() {
  const issues = [
    {
      q: "I invited the email but still getting 403 errors",
      a: "Permission propagation can take 5–60 minutes. Click 'Verify connection' after waiting. Also confirm both permissions are checked (View app info + Reply to reviews).",
    },
    {
      q: "Can't find 'Users and permissions' in the sidebar",
      a: "You may not be the account owner. Ask the Play Console owner to complete the invite. Only owners and admins see user management.",
    },
    {
      q: "Invited but reviews show 0 after sync",
      a: "Google Play Publisher API only returns reviews from the last 7 days. If your app has no recent reviews, the count is correctly 0. The portfolio rating still shows your all-time average.",
    },
    {
      q: "I see 'Package not found'",
      a: "Verify the package name in Settings → Apps matches exactly what's in your Play Console (e.g. com.yourcompany.app). No spaces, no trailing slash.",
    },
  ];

  return (
    <div className="space-y-4">
      {issues.map((item) => (
        <div key={item.q} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5">
          <p className="text-[13px] font-semibold text-gray-800">{item.q}</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-gray-500">{item.a}</p>
        </div>
      ))}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-center">
        <p className="text-[13px] font-semibold text-gray-800">Still stuck?</p>
        <p className="mt-0.5 text-[12px] text-gray-400">We reply within one business day.</p>
        <a
          href="mailto:hello@tryreviewbox.com"
          className="mt-3 inline-flex rounded-lg bg-[#0A84FF] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#0070e0]"
        >
          Email support
        </a>
      </div>
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────

export function GooglePlaySetupModal({ open, onClose, app }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("invite");
  const [email, setEmail] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  // Load service account email when modal opens
  useEffect(() => {
    if (!open || email) return;
    fetch("/api/google-play/service-account")
      .then((r) => r.json())
      .then((d: { email: string | null }) => setEmail(d.email ?? null))
      .catch(() => setEmail(null));
  }, [open, email]);

  async function handleVerify() {
    if (!app) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/apps/${app.id}/test-credentials`, { method: "POST" });
      const data = (await res.json()) as VerifyResult;
      setVerifyResult(data);
    } catch {
      setVerifyResult({ ok: false, message: "Network error — couldn't reach our server.", verifiedAt: new Date().toISOString() });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-[17px] font-semibold text-gray-900">
              Google Play connection setup
            </h2>
            <p className="mt-0.5 text-[12px] text-gray-400">
              Grant ReviewBox access so it can sync reviews and post replies on your behalf.
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-100 px-6 pt-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "pb-3 px-1 mr-4 text-left transition-colors border-b-2",
                activeTab === tab.id
                  ? "border-[#0A84FF]"
                  : "border-transparent hover:border-gray-200",
              )}
            >
              <span className={cn(
                "block text-[13px] font-semibold",
                activeTab === tab.id ? "text-gray-900" : "text-gray-500",
              )}>
                {tab.label}
              </span>
              <span className="block text-[11px] text-gray-400">{tab.sub}</span>
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: "60vh" }}>
          {activeTab === "invite" ? (
            <InviteTab email={email} verifyResult={verifyResult} />
          ) : (
            <TroubleshootTab />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-gray-100 px-6 py-4">
          <a
            href="https://play.google.com/console"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A84FF] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#0070e0] transition-colors"
          >
            Open Play Console
            <ExternalLink className="size-3.5" />
          </a>

          {app && (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              {verifying ? (
                <><Loader2 className="size-3.5 animate-spin" />Verifying…</>
              ) : verifyResult?.ok ? (
                <><CheckCircle2 className="size-3.5 text-emerald-500" />Connected ✓</>
              ) : (
                "Verify connection"
              )}
            </button>
          )}

          <button
            onClick={onClose}
            className="ml-auto text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            Close
          </button>
        </div>

        {/* Helpful footer note */}
        <div className="border-t border-gray-50 bg-gray-50 px-6 py-2.5 text-center text-[11px] text-gray-400">
          Having trouble?{" "}
          <a href="/help/connect-google-play" target="_blank" rel="noopener noreferrer" className="text-[#0A84FF] hover:underline">
            Read our Google Play troubleshooting guide →
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
