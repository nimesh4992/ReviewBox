"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Bug,
  ChevronDown,
  Gauge,
  Inbox,
  MessageSquareReply,
  Rocket,
  Settings,
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
    label: "Reviews",
    items: [
      { name: "Reviews feed",  href: "/reviews",     icon: Inbox,     signal: "127" },
      { name: "Automations",   href: "/automations", icon: Workflow,   signal: null  },
      { name: "Reply Kit",     href: "/reply-kit",   icon: BookOpen,   signal: null  },
    ],
  },
  {
    label: "Monitor",
    items: [
      { name: "Incidents", href: "/incidents", icon: AlertTriangle, signal: "2" },
      { name: "Releases", href: "/releases", icon: Rocket, signal: null },
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
          ? "bg-[#5B5BD6]/10 text-white"
          : "text-white/50 hover:bg-white/[0.05] hover:text-white/80",
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[#5B5BD6]" />
      )}
      <span className="flex min-w-0 items-center gap-2.5 pl-0.5">
        <Icon
          className={cn(
            "size-4 shrink-0",
            isActive ? "text-[#5B5BD6]" : "text-white/30 group-hover:text-white/50",
          )}
          strokeWidth={1.5}
        />
        <span className="truncate text-[13px]">{name}</span>
      </span>
      {signal && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
            isActive ? "bg-white/10 text-white/70" : "bg-white/[0.05] text-white/30",
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
          hasActive ? "text-white/60" : "text-white/25 hover:text-white/45",
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
      .catch(() => null); // fail silently — mock data still shows
  }, []); // run once on mount

  return (
    <aside
      className={cn(
        "flex h-screen w-[220px] shrink-0 flex-col bg-[#0d0f14]",
        className,
      )}
    >
      {/* Logo — flush to top */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#5B5BD6] text-[11px] font-bold text-white tracking-tight">
            R
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white tracking-tight">Revi</div>
            <div className="text-[10px] text-white/30">Review Intelligence</div>
          </div>
        </div>
      </div>

      {/* App selector */}
      <div className="px-3 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-full justify-between rounded-md border border-white/[0.07] bg-white/[0.03] px-2.5 text-left text-xs text-white/60 hover:bg-white/[0.07] hover:text-white/80"
            >
              <span className="min-w-0 truncate">{selectedApp}</span>
              <ChevronDown className="size-3 shrink-0 text-white/20" strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-52 border-white/10 bg-[#1a1d27] text-white"
          >
            <DropdownMenuLabel className="text-[11px] text-white/30">
              Workspace apps
            </DropdownMenuLabel>
            {apps.length > 0 ? apps.map((app) => (
              <DropdownMenuItem
                key={app.id}
                className="text-white/70 focus:bg-white/10 focus:text-white"
                onClick={() => setSelectedApp(app.name)}
              >
                <span className="truncate">{app.name}</span>
                {selectedApp === app.name && (
                  <span className="ml-auto text-[#5B5BD6]">✓</span>
                )}
              </DropdownMenuItem>
            )) : (
              <DropdownMenuItem
                className="text-white/40 focus:bg-white/10"
                onClick={() => {}}
              >
                No apps connected
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem
              className="text-white/70 focus:bg-white/10 focus:text-white"
              onClick={() =>
                setEnvironment(environment === "production" ? "staging" : "production")
              }
            >
              Switch to {environment === "production" ? "Staging" : "Production"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mx-3 h-px bg-white/[0.05]" />

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

      <div className="mx-3 h-px bg-white/[0.05]" />

      {/* AI triage panel */}
      <div className="p-3">
        <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/50">
              <Zap className="size-3 text-[#5B5BD6]" strokeWidth={1.5} />
              AI triage
            </span>
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              live
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-white/30">
                <Bug className="size-3 text-red-400" strokeWidth={1.5} />
                Crash cluster
              </span>
              <span className="font-medium text-white/60">21</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-white/30">
                <MessageSquareReply className="size-3 text-amber-400" strokeWidth={1.5} />
                Needs reply
              </span>
              <span className="font-medium text-white/60">46</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-white/30">
                <Activity className="size-3 text-indigo-400" strokeWidth={1.5} />
                SLA window
              </span>
              <span className="font-medium text-amber-400">2h 14m</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
