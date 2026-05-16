"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export function FirstVisitModal() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [open, setOpen]                   = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [appName, setAppName]             = useState("");
  const [platform, setPlatform]           = useState<"google-play" | "app-store">("google-play");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (!user.publicMetadata?.onboarded) setOpen(true);
  }, [isLoaded, user]);

  const slug = slugify(workspaceName);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceName.trim() || !appName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/complete", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: workspaceName.trim(),
          workspaceSlug: slug || "my-workspace",
          appName:       appName.trim(),
          platform,
          storeId:       "",
        }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(
          data.error === "SLUG_TAKEN"
            ? "That workspace name is already taken — try a different one."
            : "Something went wrong. Please try again.",
        );
        return;
      }

      await user?.reload();
      setOpen(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-[420px] rounded-[20px] bg-white shadow-2xl">
        <div className="p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-[#0A84FF] text-[15px] font-bold text-white">
              R
            </div>
            <h2 className="text-[22px] font-semibold tracking-[-0.022em] text-fg-1">
              Welcome to ReviewBox
            </h2>
            <p className="mt-1.5 text-[14px] text-fg-3">
              Two fields. Thirty seconds. No credit card.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Workspace name */}
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-fg-2">
                Workspace name
              </label>
              <input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Acme Inc"
                required
                autoFocus
                className="h-10 w-full rounded-[8px] border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-3 text-[14px] text-fg-1 placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/30"
              />
              {slug && (
                <p className="mt-1 text-[11px] text-fg-3">
                  tryreviewbox.com/<span className="font-medium text-fg-2">{slug}</span>
                </p>
              )}
            </div>

            {/* App name */}
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-fg-2">
                Your app name
              </label>
              <input
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="My Awesome App"
                required
                className="h-10 w-full rounded-[8px] border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-3 text-[14px] text-fg-1 placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/30"
              />
            </div>

            {/* Platform */}
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-fg-2">
                Platform
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["google-play", "app-store"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={cn(
                      "rounded-[8px] border py-2.5 text-[13px] font-medium transition-colors",
                      platform === p
                        ? "border-[#0A84FF] bg-[#0A84FF]/[0.08] text-[#0A84FF]"
                        : "border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] text-fg-2 hover:border-[var(--rb-border-2)]",
                    )}
                  >
                    {p === "google-play" ? "Google Play" : "App Store"}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="rounded-[8px] bg-[#DC2626]/[0.08] px-3 py-2 text-[13px] text-[#DC2626]">
                {error}
              </p>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading || !workspaceName.trim() || !appName.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-[#0A84FF] py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#006EE0] disabled:opacity-50"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {loading ? "Setting up…" : "Get started →"}
              </button>
            </div>
          </form>
        </div>

        <div className="border-t border-[var(--rb-border-1)] px-8 py-4">
          <p className="text-center text-[12px] text-fg-3">
            You can connect Google Play and App Store later in Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
