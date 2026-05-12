"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle, Menu, Search } from "lucide-react";

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

const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    severity: "red",
    title: "Crash spike detected",
    subtitle: "21 reviews mention crashes in v2.4.1",
    time: "2h ago",
    href: "/incidents",
  },
  {
    id: "2",
    severity: "yellow",
    title: "46 reviews need a reply",
    subtitle: "Oldest is 3 days ago",
    time: "Today",
    href: "/reviews",
  },
  {
    id: "3",
    severity: "green",
    title: "Weekly digest ready",
    subtitle: "Your app rating improved 0.2★ this week",
    time: "Yesterday",
    href: "/dashboard",
  },
];

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

  function handleNotifClick(href: string) {
    setNotifOpen(false);
    router.push(href);
  }

  return (
    <header className="sticky top-0 z-30 flex h-13 items-center justify-between gap-3 border-b border-gray-100/80 bg-white/80 px-4 backdrop-blur-xl md:px-6">
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

      {/* Centre — search pill */}
      <div className="mx-auto w-full max-w-sm">
        <label className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-3.5 size-3.5 text-gray-400"
            strokeWidth={1.5}
          />
          <input
            type="search"
            placeholder="Search reviews, versions, tags…"
            className="h-9 w-full rounded-full border border-gray-200 bg-gray-50 pl-9 pr-14 text-sm text-gray-800 placeholder:text-gray-400 transition-colors duration-150 focus:border-[#5B5BD6]/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5B5BD6]/20"
          />
          <kbd className="pointer-events-none absolute right-3 hidden items-center gap-0.5 rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-400 shadow-sm sm:flex">
            <span className="text-[11px]">⌘</span>K
          </kbd>
        </label>
      </div>

      {/* Right — env badge, notifications, avatar */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-medium text-gray-500 transition-colors duration-150 hover:bg-gray-100 lg:inline-flex">
          Production
        </span>

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
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-gray-400 hover:text-gray-600"
              >
                Mark all read
              </Button>
            </SheetHeader>

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto">
              {SAMPLE_NOTIFICATIONS.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <CheckCircle
                    className="size-8 text-gray-300"
                    strokeWidth={1.5}
                  />
                  <p className="text-sm text-gray-400">You&apos;re all caught up</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {SAMPLE_NOTIFICATIONS.map((notif) => (
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
                className="text-xs text-[#5B5BD6] hover:underline"
              >
                Notification settings
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <button
          className="flex size-7 items-center justify-center rounded-full bg-[#5B5BD6] text-[11px] font-semibold text-white ring-2 ring-white transition-opacity duration-150 hover:opacity-90"
          aria-label="Account"
        >
          NS
        </button>
      </div>
    </header>
  );
}
