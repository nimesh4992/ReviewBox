"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { useApps } from "@/hooks/use-apps";

const DISMISS_KEY = "rb_cred_banner_dismissed";

// CredentialsBanner deliberately uses the shared `useApps()` hook instead of
// its own `useQuery`. The reason: both this component and `useApps()` used to
// register the same React Query key `["apps"]` but with DIFFERENT queryFns —
// one returning `{ apps: [...] }` (object) and the other returning `WorkspaceApp[]`
// (plain array). React Query deduplicates requests by key, so whichever hook
// mounted first (the layout banner, always) would poison the cache with an object
// shape. Page components then received an object where they expected an array,
// causing `D.some is not a function` (dashboard) and `e.map is not a function`
// (settings) production crashes.

export function CredentialsBanner() {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const wasDismissed =
      typeof window !== "undefined" &&
      sessionStorage.getItem(DISMISS_KEY) === "1";
    setDismissed(wasDismissed);
  }, []);

  const { apps } = useApps();

  const hasAtLeastOneApp = apps.length > 0;
  const anyMissingCredentials = apps.some((a) => !a.has_credentials);
  const shouldShow = hasAtLeastOneApp && anyMissingCredentials && !dismissed;

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (!shouldShow) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{ backgroundColor: "#0A84FF" }}
      className="flex items-center justify-between gap-3 px-4 py-2.5 text-white text-sm"
    >
      <span className="flex-1">
        Your store account isn&apos;t linked yet — ReviewBox can&apos;t fetch reviews.
      </span>
      <button
        onClick={() => router.push("/settings")}
        className="font-medium underline underline-offset-2 whitespace-nowrap hover:opacity-80 transition-opacity"
      >
        Link account →
      </button>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss banner"
        className="ml-1 p-0.5 rounded hover:bg-white/20 transition-colors"
      >
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
