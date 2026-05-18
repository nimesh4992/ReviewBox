"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import { AlertTriangle, Loader2 } from "lucide-react";

export default function AccountDeletedPage() {
  const router = useRouter();
  const { sessionClaims } = useAuth();
  const { signOut } = useClerk();
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metadata = (sessionClaims?.metadata ?? {}) as { accountDeletedAt?: string };
  const deletedAt = metadata.accountDeletedAt ? new Date(metadata.accountDeletedAt) : null;
  const hardDeleteAt = deletedAt ? new Date(deletedAt.getTime() + 30 * 86400000) : null;
  const daysLeft = hardDeleteAt
    ? Math.max(0, Math.ceil((hardDeleteAt.getTime() - Date.now()) / 86400000))
    : 0;

  async function handleRestore() {
    setRestoring(true);
    setError(null);
    try {
      const res = await fetch("/api/account/restore", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? "Couldn't restore your account.");
      }
      // Force a fresh session to pick up the cleared metadata
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't restore your account.");
      setRestoring(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F5F7] px-4 py-16">
      <div className="w-full max-w-md rounded-[18px] border border-black/[0.06] bg-white p-7 shadow-[0_2px_24px_rgba(0,0,0,0.08)]">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-amber-50">
          <AlertTriangle className="size-6 text-amber-500" strokeWidth={1.5} />
        </div>

        <h1 className="text-[20px] font-semibold tracking-[-0.015em] text-[#1D1D1F]">
          Your account is scheduled for deletion
        </h1>

        <p className="mt-2 text-[14px] leading-relaxed text-[#48484D]">
          We&apos;ll permanently delete your workspace and all reviews, replies, and
          team data in{" "}
          <span className="font-semibold text-[#1D1D1F]">
            {daysLeft} {daysLeft === 1 ? "day" : "days"}
          </span>
          . Change your mind? You can restore it now.
        </p>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={handleRestore}
            disabled={restoring}
            className="flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-[#0A84FF] text-[14px] font-semibold text-white transition-colors hover:bg-[#006EE0] disabled:opacity-50"
          >
            {restoring ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
                Restoring…
              </>
            ) : (
              "Restore my account"
            )}
          </button>
          <button
            onClick={handleSignOut}
            className="h-10 rounded-[10px] border border-black/[0.08] bg-white text-[13px] font-medium text-[#48484D] transition-colors hover:bg-[#F5F5F7]"
          >
            Sign out
          </button>
        </div>

        <p className="mt-5 text-[12px] text-[#86868B]">
          Need help? Email{" "}
          <a href="mailto:hello@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
            hello@tryreviewbox.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
