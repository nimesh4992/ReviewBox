"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

const DISMISS_KEY = "rb_cred_banner_dismissed";

interface AppEntry {
  id: string;
  has_credentials: boolean;
}

interface AppsResponse {
  apps: AppEntry[];
}

async function fetchApps(): Promise<AppsResponse> {
  const res = await fetch("/api/apps");
  if (!res.ok) throw new Error("Failed to fetch apps");
  return res.json();
}

export function CredentialsBanner() {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const wasDismissed =
      typeof window !== "undefined" &&
      sessionStorage.getItem(DISMISS_KEY) === "1";
    setDismissed(wasDismissed);
  }, []);

  const { data } = useQuery<AppsResponse>({
    queryKey: ["apps"],
    queryFn: fetchApps,
    staleTime: 30_000,
  });

  const apps = data?.apps ?? [];
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
