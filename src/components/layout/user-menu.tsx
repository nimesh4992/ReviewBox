"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { LogOut, Settings, CreditCard, User as UserIcon, Loader2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Account menu shared by the top-nav avatar and the sidebar profile chunk.
 *
 * Provides: profile display · settings link · billing link · sign out.
 * Sign out clears the Clerk session AND hard-navigates to /sign-in so the
 * Supabase + React Query caches are dropped (otherwise a re-signin in the
 * same tab would still see the previous user's React Query data).
 */
export function UserMenu({
  variant = "avatar",
  className,
}: {
  /** "avatar" = circular button (top nav). "row" = full-width row (sidebar). */
  variant?: "avatar" | "row";
  className?: string;
}) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [signingOut, setSigningOut] = useState(false);

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user?.firstName?.[0]?.toUpperCase() ??
        user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ??
        "?";

  const displayName =
    user?.fullName ??
    user?.firstName ??
    user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ??
    "Account";

  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";

  const plan =
    ((user?.publicMetadata as { plan?: string } | undefined)?.plan as string | undefined) ??
    "trial";
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      // signOut clears the Clerk session; redirectUrl ensures we land on
      // /sign-in via a full page load so all in-memory state is dropped.
      await signOut({ redirectUrl: "/sign-in" });
    } catch (err) {
      console.error("[user-menu] signOut failed:", err);
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "avatar" ? (
          <button
            className={cn(
              "flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-[#4592FF] to-[#0058B3] text-[11px] font-semibold text-white ring-2 ring-white transition-opacity duration-150 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#0A84FF] focus:ring-offset-2",
              className,
            )}
            aria-label="Account menu"
          >
            {initials}
          </button>
        ) : (
          <button
            className={cn(
              "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-black/[0.04] focus:outline-none focus:bg-black/[0.04] dark:hover:bg-white/[0.06] dark:focus:bg-white/[0.06]",
              className,
            )}
            aria-label="Account menu"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4592FF] to-[#0058B3] text-[11px] font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {displayName}
              </div>
              <div className="text-[10px] text-[#86868B]">
                {planLabel}
              </div>
            </div>
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={variant === "avatar" ? "end" : "start"}
        className="w-60 border-black/[0.08] bg-white text-[#1D1D1F] shadow-lg dark:bg-[#1F1F22] dark:border-white/[0.08] dark:text-[#F5F5F7]"
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
          <span className="text-[13px] font-semibold">{displayName}</span>
          {email && (
            <span className="truncate text-[11px] font-normal text-[#86868B]">{email}</span>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-black/[0.06]" />

        <DropdownMenuItem
          onClick={() => router.push("/settings")}
          className="cursor-pointer gap-2 text-[13px] text-[#48484D] focus:bg-black/[0.04] focus:text-[#1D1D1F]"
        >
          <UserIcon className="size-3.5" strokeWidth={1.5} />
          Profile &amp; team
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => router.push("/settings")}
          className="cursor-pointer gap-2 text-[13px] text-[#48484D] focus:bg-black/[0.04] focus:text-[#1D1D1F]"
        >
          <Settings className="size-3.5" strokeWidth={1.5} />
          Workspace settings
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => router.push("/billing")}
          className="cursor-pointer gap-2 text-[13px] text-[#48484D] focus:bg-black/[0.04] focus:text-[#1D1D1F]"
        >
          <CreditCard className="size-3.5" strokeWidth={1.5} />
          Billing
          <span className="ml-auto rounded-full bg-[#0A84FF]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#0A84FF]">
            {planLabel}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-black/[0.06]" />

        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={signingOut}
          className="cursor-pointer gap-2 text-[13px] text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-500/10"
        >
          {signingOut ? (
            <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
          ) : (
            <LogOut className="size-3.5" strokeWidth={1.5} />
          )}
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
