"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const [status, setStatus] = useState<"loading" | "accepting" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    // Not signed in → bounce to sign-up with redirect back to this page
    if (!isSignedIn) {
      const target = encodeURIComponent(`/invite/${params.token}`);
      router.replace(`/sign-up?redirect_url=${target}`);
      return;
    }

    // Signed in → accept the invite
    setStatus("accepting");
    fetch("/api/account/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(data.error?.message ?? "Couldn't accept invite.");
        }
        // Full reload so middleware sees the new onboarded=true metadata
        window.location.href = "/dashboard";
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Couldn't accept invite.");
        setStatus("error");
      });
  }, [isLoaded, isSignedIn, params.token, router]);

  return (
    // Fully tokenized: this page mixed a hardcoded light card (bg-white on
    // #F5F5F7) with --rb-fg-* text, so in dark mode the copy rendered
    // near-white on white — an invisible error message on the invite flow.
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-16">
      <div className="w-full max-w-md rounded-[18px] border border-[var(--rb-border-1)] bg-surface p-7 shadow-[var(--rb-shadow-sm)]">
        {status === "loading" || status === "accepting" ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="size-6 animate-spin text-[#0A84FF]" strokeWidth={1.5} />
            <p className="text-[13px] text-fg-3">
              {status === "loading" ? "Checking your invitation…" : "Adding you to the workspace…"}
            </p>
          </div>
        ) : (
          <div>
            <h1 className="text-[18px] font-semibold text-fg-1">Invitation problem</h1>
            <p className="mt-2 text-[14px] text-fg-2">{error}</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-5 h-10 w-full rounded-[10px] bg-[#0A84FF] text-[14px] font-semibold text-white hover:bg-[#006EE0]"
            >
              Go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
