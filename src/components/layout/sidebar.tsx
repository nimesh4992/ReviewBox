"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Activity,
  AlertTriangle,
  BarChart2,
  BookOpen,
  Bug,
  ChevronDown,
  ChevronUp,
  FileBarChart,
  Gauge,
  Inbox,
  MessageSquareReply,
  Rocket,
  Search,
  Settings,
  Trophy,
  Workflow,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/use-workspace-store";

// ── Navigation structure ──────────────────────────────────────────────────────

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  signal: string | null;
};

type NavGroup = {
  label: string | null;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { name: "Dashboard", href: "/dashboard", icon: Gauge, signal: null },
    ],
  },
  {
    label: "Inbox",
    items: [
      { name: "Reviews",    href: "/reviews",     icon: Inbox,    signal: "127" },
      { name: "Automations", href: "/automations", icon: Workflow,  signal: null  },
      { name: "Reply Kit",   href: "/reply-kit",   icon: BookOpen,  signal: null  },
    ],
  },
  {
    label: "Insights",
    items: [
      { name: "Sentiment",   href: "/sentiment",   icon: BarChart2,    signal: null },
      { name: "Competitors", href: "/competitors", icon: Trophy,       signal: null },
      { name: "ASO",         href: "/aso",         icon: Search,       signal: null },
      { name: "Reports",     href: "/reports",     icon: FileBarChart, signal: null },
    ],
  },
  {
    label: "Monitor",
    items: [
      { name: "Incidents", href: "/incidents", icon: AlertTriangle, signal: "2" },
      { name: "Releases",  href: "/releases",  icon: Rocket,        signal: null },
    ],
  },
  {
    label: "Settings",
    items: [
      { name: "Settings", href: "/settings", icon: Settings, signal: null },
    ],
  },
];

// ── NavItem ───────────────────────────────────────────────────────────────────

function SidebarNavItem({
  href,
  name,
  icon: Icon,
  signal,
  isActive,
  indent = false,
}: NavItem & { isActive: boolean; indent?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-9 items-center justify-between rounded-md px-2.5 text-sm transition-colors duration-150",
        indent && "ml-3",
        isActive
          ? "bg-[#0A84FF]/10 text-[#0058B3] dark:bg-[#0A84FF]/20 dark:text-[#4592FF]"
          : "text-[#48484D] hover:bg-black/[0.04] hover:text-[#1D1D1F] dark:text-[#8E8E93] dark:hover:bg-white/[0.06] dark:hover:text-[#F5F5F7]",
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[#0A84FF]" />
      )}
      <span className="flex min-w-0 items-center gap-2.5 pl-0.5">
        <Icon
          className={cn(
            "size-4 shrink-0",
            isActive ? "text-[#0A84FF]" : "text-[#86868B] group-hover:text-[#48484D] dark:group-hover:text-[#F5F5F7]",
          )}
          strokeWidth={1.5}
        />
        <span className="truncate text-[13px]">{name}</span>
      </span>
      {signal && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
            isActive
              ? "bg-[#0A84FF]/15 text-[#0A84FF]"
              : "bg-black/[0.06] text-[#86868B] dark:bg-white/[0.08]",
          )}
        >
          {signal}
        </span>
      )}
    </Link>
  );
}

// ── NavGroup ──────────────────────────────────────────────────────────────────

function SidebarNavGroup({
  label,
  items,
  pathname,
}: NavGroup & { pathname: string }) {
  const hasActive = items.some((i) => pathname === i.href);
  const [open, setOpen] = useState(true);

  if (!label) {
    return (
      <div className="space-y-0.5">
        {items.map((item) => (
          <SidebarNavItem
            key={item.href}
            {...item}
            isActive={pathname === item.href}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left transition-colors",
          hasActive
            ? "text-[#48484D] dark:text-[#C7C7CC]"
            : "text-[#86868B] hover:text-[#48484D] dark:hover:text-[#C7C7CC]",
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest">{label}</span>
        <ChevronDown
          className={cn(
            "size-3 transition-transform duration-150",
            !open && "-rotate-90",
          )}
          strokeWidth={1.5}
        />
      </button>

      {open && (
        <div className="mt-0.5 space-y-0.5">
          {items.map((item) => (
            <SidebarNavItem
              key={item.href}
              {...item}
              isActive={pathname === item.href}
              indent={items.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface App { id: string; name: string; platform: string }

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const { selectedApp, setSelectedApp, environment, setEnvironment } = useWorkspaceStore();
  const [apps, setApps] = useState<App[]>([]);

  useEffect(() => {
    fetch("/api/apps")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { apps: App[] } | null) => {
        if (data?.apps?.length) {
          setApps(data.apps);
        }
      })
      .catch(() => null);
  }, []);

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : user?.firstName?.[0]?.toUpperCase() ??
        user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ??
        "U";

  const displayName =
    user?.fullName ??
    user?.firstName ??
    user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ??
    "User";

  return (
    <aside
      className={cn(
        "flex h-screen w-[220px] shrink-0 flex-col bg-[#F5F5F7] border-r border-black/[0.06] dark:bg-[#0E0E11] dark:border-white/[0.06]",
        className,
      )}
    >
      {/* Logo */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#0A84FF] text-[11px] font-bold text-white tracking-tight">
            R
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">ReviewBox</div>
            <div className="text-[10px] text-[#86868B]">Review Intelligence</div>
          </div>
        </div>
      </div>

      {/* Demo mode banner — shown until workspace is connected */}
      {isLoaded && !user?.publicMetadata?.onboarded && (
        <div className="mx-3 mb-2 rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              Demo data
            </span>
            <span className="size-1.5 rounded-full bg-amber-400" />
          </div>
          <p className="mt-0.5 text-[10px] leading-tight text-amber-600 dark:text-amber-500">
            Viewing sample data — connect your app to go live
          </p>
        </div>
      )}

      {/* App selector */}
      <div className="px-3 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-full justify-between rounded-md border border-black/[0.07] bg-black/[0.02] px-2.5 text-left text-xs text-[#48484D] hover:bg-black/[0.04] hover:text-[#1D1D1F] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#8E8E93] dark:hover:bg-white/[0.06] dark:hover:text-[#F5F5F7]"
            >
              <span className="min-w-0 truncate">{selectedApp}</span>
              <ChevronDown className="size-3 shrink-0 text-[#86868B]" strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-52 border-black/[0.08] bg-white text-[#1D1D1F] shadow-lg dark:bg-[#1F1F22] dark:border-white/[0.08] dark:text-[#F5F5F7]"
          >
            <DropdownMenuLabel className="text-[11px] text-[#86868B]">
              Workspace apps
            </DropdownMenuLabel>
            {apps.length > 0 ? apps.map((app) => (
              <DropdownMenuItem
                key={app.id}
                className="text-[#48484D] focus:bg-black/[0.04] focus:text-[#1D1D1F]"
                onClick={() => setSelectedApp(app.name)}
              >
                <span className="truncate">{app.name}</span>
                {selectedApp === app.name && (
                  <span className="ml-auto text-[#0A84FF]">✓</span>
                )}
              </DropdownMenuItem>
            )) : (
              <DropdownMenuItem
                className="text-[#86868B] focus:bg-black/[0.04]"
                onClick={() => {}}
              >
                No apps connected
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-black/[0.06]" />
            <DropdownMenuItem
              className="text-[#48484D] focus:bg-black/[0.04] focus:text-[#1D1D1F]"
              onClick={() =>
                setEnvironment(environment === "production" ? "staging" : "production")
              }
            >
              Switch to {environment === "production" ? "Staging" : "Production"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mx-3 h-px bg-black/[0.06] dark:bg-white/[0.06]" />

      {/* Navigation */}
      <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {navGroups.map((group, i) => (
          <SidebarNavGroup
            key={i}
            label={group.label}
            items={group.items}
            pathname={pathname}
          />
        ))}
      </nav>

      <div className="mx-3 h-px bg-black/[0.06] dark:bg-white/[0.06]" />

      {/* AI triage panel */}
      <div className="p-3">
        <div className="rounded-lg border border-black/[0.06] bg-black/[0.02] p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#48484D] dark:text-[#C7C7CC]">
              <Zap className="size-3 text-[#0A84FF]" strokeWidth={1.5} />
              AI triage
            </span>
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              live
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-[#86868B]">
                <Bug className="size-3 text-red-500" strokeWidth={1.5} />
                Crash cluster
              </span>
              <span className="font-medium text-[#48484D] dark:text-[#C7C7CC]">21</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-[#86868B]">
                <MessageSquareReply className="size-3 text-amber-500" strokeWidth={1.5} />
                Needs reply
              </span>
              <span className="font-medium text-[#48484D] dark:text-[#C7C7CC]">46</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-[#86868B]">
                <Activity className="size-3 text-indigo-500" strokeWidth={1.5} />
                SLA window
              </span>
              <span className="font-medium text-amber-600">2h 14m</span>
            </div>
          </div>
        </div>
      </div>

      {/* User profile */}
      <div className="border-t border-black/[0.06] px-3 py-2.5 dark:border-white/[0.06]">
        <div className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4592FF] to-[#0058B3] text-[11px] font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{displayName}</div>
            <div className="text-[10px] text-[#86868B]">Pro Plan</div>
          </div>
          <ChevronUp className="size-3.5 shrink-0 text-[#86868B]" strokeWidth={1.5} />
        </div>
      </div>
    </aside>
  );
}
