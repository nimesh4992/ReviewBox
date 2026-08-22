"use client";

import { useEffect, useState } from "react";
import { Copy, Check, ExternalLink, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DISMISSED_KEY = "rb_gplay_invite_dismissed";

interface Props {
  /** Pass the apps list so we only show this for workspaces with a Google Play app. */
  hasGooglePlayApp: boolean;
}

export function GooglePlayInviteModal({ hasGooglePlayApp }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [emailFailed, setEmailFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Determine whether to show on mount (client-only: reads localStorage).
  useEffect(() => {
    if (!hasGooglePlayApp) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    setOpen(true);
  }, [hasGooglePlayApp]);

  /**
   * Fetch the service account email once the modal opens.
   *
   * The failure path used to leave `email` null, and null renders the
   * "Loading…" placeholder — so a 500 produced a spinner that never resolved,
   * in a modal whose entire purpose is to hand the customer one string to copy.
   * `emailFailed` separates "still fetching" from "we could not fetch".
   */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setEmailFailed(false);
      try {
        const res = await fetch("/api/google-play/service-account");
        if (!res.ok) throw new Error(`service account load failed: ${res.status}`);
        const d = (await res.json()) as { email?: string | null };
        if (!cancelled) setEmail(d.email ?? null);
      } catch {
        if (!cancelled) { setEmail(null); setEmailFailed(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setOpen(false);
  }

  async function copyEmail() {
    if (!email) return;
    await navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-[#0A84FF] px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold">
              One step to start syncing reviews
            </DialogTitle>
          </DialogHeader>
          <p className="mt-1 text-sm text-blue-100">
            ReviewBox needs access to your Google Play Console. Takes about 2 minutes.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Email copy box */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-fg-3 mb-2">
              Invite this email to your Play Console
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-4 py-3">
              {email ? (
                <>
                  <span className="flex-1 text-sm font-mono text-fg-1 select-all break-all">
                    {email}
                  </span>
                  <button
                    onClick={copyEmail}
                    className="flex items-center gap-1.5 rounded-lg bg-surface border border-[var(--rb-border-1)] px-3 py-1.5 text-xs font-medium text-fg-2 hover:bg-[var(--rb-bg-hover)] transition-colors shrink-0"
                  >
                    {copied ? (
                      <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copied</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5" /> Copy</>
                    )}
                  </button>
                </>
              ) : emailFailed ? (
                <span className="text-sm text-[var(--rb-amber-600)]">
                  Couldn&rsquo;t load the address — close this and open it again.
                </span>
              ) : (
                <span className="text-sm text-fg-3">Loading…</span>
              )}
            </div>
          </div>

          {/* Steps */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-fg-3 mb-3">
              How to invite it
            </p>
            <ol className="space-y-2.5">
              {[
                <>Open <a href="https://play.google.com/console" target="_blank" rel="noopener noreferrer" className="text-[#0A84FF] hover:underline">play.google.com/console</a> → <strong>Setup → API access</strong></>,
                <>Under <strong>Service accounts</strong>, find the email above and click <strong>Manage Play Console permissions</strong></>,
                <>Under <strong>Account permissions</strong>, enable <strong>Reply to reviews</strong></>,
                <>Click <strong>Invite user → Send invitation</strong></>,
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0A84FF]/10 text-[10px] font-bold text-[#0A84FF] mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-fg-2 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Note */}
          <p className="text-xs text-fg-3 leading-relaxed">
            Permissions can take up to 24 hours to activate. Your first reviews will appear once the sync runs.{" "}
            <a href="/help/connect-google-play" className="text-[#0A84FF] hover:underline">
              Full guide
            </a>
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-between gap-3">
          <a
            href="https://play.google.com/console"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A84FF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0070e0] transition-colors"
          >
            Open Play Console
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={dismiss}
            className="text-sm text-fg-3 hover:text-fg-1 transition-colors"
          >
            I&apos;ll do this later
          </button>
        </div>

        {/* Close X */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-lg p-1 text-white/70 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </DialogContent>
    </Dialog>
  );
}
