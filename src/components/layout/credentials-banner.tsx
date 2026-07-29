"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const wasDismissed =
      typeof window !== "undefined" &&
      sessionStorage.getItem(DISMISS_KEY) === "1";
    setDismissed(wasDismissed);
  }, []);

  const { apps } = useApps();

  // The dashboard renders its own, richer status strip for exactly this
  // state — showing this bar there too meant two banners about one problem.
  const onDashboard = pathname === "/dashboard";

  const hasAtLeastOneApp = apps.length > 0;
  const anyMissingCredentials = apps.some((a) => !a.has_credentials);
  const shouldShow =
    hasAtLeastOneApp && anyMissingCredentials && !dismissed && !onDashboard;

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (!shouldShow) return null;

  // Quiet strip, not a solid-blue shout: this renders above every screen, so
  // it has to coexist with real work. Sunken background, one accent link.
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 border-b border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-4 py-2 text-rb-sm text-fg-2"
    >
      <span className="min-w-0 flex-1 truncate">
        Store account not linked yet — reviews can&apos;t sync until it is.
      </span>
      <button
        onClick={() => router.push("/settings?tab=integrations")}
        className="shrink-0 font-medium text-[var(--rb-blue-500)] hover:underline"
      >
        Link account
      </button>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 text-fg-3 transition-colors hover:text-fg-1"
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}
