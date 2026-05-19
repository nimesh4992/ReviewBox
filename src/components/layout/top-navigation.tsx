"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Bell, CheckCircle, Menu, Moon, Plus, Search, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/use-workspace-store";

// ── Notification data ─────────────────────────────────────────────────────────

type NotifSeverity = "red" | "yellow" | "green";

interface Notification {
  id: string;
  severity: NotifSeverity;
  title: string;
  subtitle: string;
  time: string;
  href: string;
}

// Notifications are intentionally empty here. A real notification feed
// (rating spikes, urgent unreplied, incidents) is queued for a future
// backlog item. Until then we show the "all caught up" empty state to
// avoid presenting hardcoded data for apps the user doesn't have.
const NOTIFICATIONS: Notification[] = [];

const severityDot: Record<NotifSeverity, string> = {
  red: "bg-red-400",
  yellow: "bg-amber-400",
  green: "bg-emerald-400",
};

// ── TopNavigation ─────────────────────────────────────────────────────────────

interface TopNavigationProps {
  onOpenSidebar: () => void;
}

export function TopNavigation({ onOpenSidebar }: TopNavigationProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const router = useRouter();
  const { theme, toggleTheme } = useWorkspaceStore();
  const { user } = useUser();

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user?.firstName?.[0]?.toUpperCase() ??
        user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ??
        "?";

  function handleNotifClick(href: string) {
    setNotifOpen(false);
    router.push(href);
  }

  return (
    <header className="sticky top-0 z-30 flex h-13 items-center justify-between gap-3 border-b border-black/[0.06] bg-white/70 px-4 backdrop-blur-xl backdrop-saturate-150 md:px-6 dark:border-white/[0.06] dark:bg-[#0B0B0E]/80">
      {/* Left — mobile menu trigger */}
      <div className="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-gray-400 hover:bg-gray-100 md:hidden"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
        >
          <Menu className="size-4" strokeWidth={1.5} />
        </Button>
      </div>

      {/* Centre — search box */}
      <div className="mx-auto hidden w-[280px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 h-8 md:flex dark:border-white/[0.08] dark:bg-white/[0.04]">
        <Search className="size-3.5 shrink-0 text-gray-400" strokeWidth={1.5} />
        <input
          type="search"
          placeholder="Search reviews, apps, tags…"
          className="flex-1 border-0 bg-transparent text-[13px] text-gray-800 placeholder:text-gray-400 outline-none dark:text-[#F5F5F7] dark:placeholder:text-[#636366]"
        />
        <kbd className="hidden items-center gap-0.5 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-400 shadow-sm sm:flex dark:border-white/[0.08] dark:bg-white/[0.04]">
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </div>

      {/* Right — Connect app CTA, notifications, avatar */}
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/settings">
          <button className="flex h-8 items-center gap-1.5 rounded-lg bg-[#0A84FF] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#006EE0]">
            <Plus className="size-3.5" strokeWidth={2.5} />
            <span className="hidden sm:inline">Connect app</span>
          </button>
        </Link>

        {/* Dark mode toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-[#C7C7CC]"
              aria-label="Toggle dark mode"
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <Sun className="size-4" strokeWidth={1.5} />
              ) : (
                <Moon className="size-4" strokeWidth={1.5} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{theme === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
        </Tooltip>

        {/* Bell — opens notification sheet */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Notifications"
              onClick={() => setNotifOpen(true)}
            >
              <Bell className="size-4" strokeWidth={1.5} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        {/* Notification sheet */}
        <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
          <SheetContent
            side="right"
            className="flex w-80 flex-col gap-0 border-l border-gray-100 bg-white p-0"
          >
            {/* Header */}
            <SheetHeader className="flex-row items-center justify-between border-b border-gray-100 px-4 py-3">
              <SheetTitle className="text-sm font-semibold text-gray-900">
                Notifications
              </SheetTitle>
              {NOTIFICATIONS.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-gray-400 hover:text-gray-600"
                >
                  Mark all read
                </Button>
              )}
            </SheetHeader>

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto">
              {NOTIFICATIONS.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <CheckCircle
                    className="size-8 text-gray-300"
                    strokeWidth={1.5}
                  />
                  <p className="text-sm text-gray-400">You&apos;re all caught up</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {NOTIFICATIONS.map((notif) => (
                    <li key={notif.id}>
                      <button
                        onClick={() => handleNotifClick(notif.href)}
                        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50"
                      >
                        {/* Severity dot */}
                        <span
                          className={cn(
                            "mt-1.5 size-2 shrink-0 rounded-full",
                            severityDot[notif.severity],
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-gray-900">
                            {notif.title}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-400">
                            {notif.subtitle}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] text-gray-400">
                          {notif.time}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-4 py-3">
              <button
                onClick={() => handleNotifClick("/settings")}
                className="text-xs text-[#0A84FF] hover:underline"
              >
                Notification settings
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <button
          className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-[#4592FF] to-[#0058B3] text-[11px] font-semibold text-white ring-2 ring-white transition-opacity duration-150 hover:opacity-90"
          aria-label="Account"
        >
          {initials}
        </button>
      </div>
    </header>
  );
}
