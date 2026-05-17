"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Sparkles, X } from "lucide-react";

export function TrialBanner() {
  const { sessionClaims } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const metadata = (sessionClaims?.metadata ?? {}) as {
    plan?: string;
    trialEndsAt?: string;
  };

  // Hydrate dismissed state from sessionStorage (resets per browser session)
  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(sessionStorage.getItem("rb-trial-banner-dismissed") === "1");
    }
  }, []);

  if (metadata.plan !== "trial" || !metadata.trialEndsAt) return null;
  if (dismissed) return null;

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(metadata.trialEndsAt).getTime() - Date.now()) / 86400000),
  );

  if (daysLeft <= 0) return null; // middleware handles expiry

  function dismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("rb-trial-banner-dismissed", "1");
    }
  }

  const urgent = daysLeft <= 3;

  return (
    <div
      className={
        urgent
          ? "flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] dark:border-amber-900/40 dark:bg-amber-950/20"
          : "flex items-center gap-3 rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-surface)] px-4 py-2.5 text-[13px] shadow-[var(--rb-shadow-xs)]"
      }
    >
      <Sparkles
        className={urgent ? "size-4 shrink-0 text-amber-600" : "size-4 shrink-0 text-[#0A84FF]"}
        strokeWidth={1.5}
      />
      <span className={urgent ? "text-amber-900 dark:text-amber-200" : "text-[var(--rb-fg-2)]"}>
        <span className="font-semibold">
          {daysLeft} day{daysLeft === 1 ? "" : "s"} left in your free trial
        </span>
        <span className="ml-1.5 text-[var(--rb-fg-3)]">
          {urgent ? "— upgrade now to keep your data." : "— upgrade anytime."}
        </span>
      </span>
      <Link
        href="/billing"
        className="ml-auto rounded-md bg-[#0A84FF] px-3 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-[#006EE0]"
      >
        Upgrade
      </Link>
      <button
        onClick={dismiss}
        className="text-[var(--rb-fg-3)] transition-colors hover:text-[var(--rb-fg-1)]"
        aria-label="Dismiss"
      >
        <X className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}
