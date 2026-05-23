"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  ChevronDown,
  FileBarChart,
  Gauge,
  Inbox,
  Rocket,
  Search,
  Settings,
  Trophy,
  Workflow,
} from "lucide-react";

import { UserMenu } from "@/components/layout/user-menu";

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

// Signal numbers were previously hardcoded ("127" inbox, "2" incidents).
// Until they're wired to real counts via React Query, all set to null so
// we don't lie to users about what's in their workspace.
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
      { name: "Inbox",       href: "/inbox",       icon: Inbox,    signal: null },
      { name: "Automations", href: "/automations", icon: Workflow,  signal: null },
      { name: "Reply Kit",   href: "/reply-kit",   icon: BookOpen,  signal: null },
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
      { name: "Incidents", href: "/incidents", icon: AlertTriangle, signal: null },
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
  const { selectedApp, setSelectedApp } = useWorkspaceStore();
  const [apps, setApps] = useState<App[]>([]);

  useEffect(() => {
    fetch("/api/apps")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { apps: App[] } | null) => {
        if (data?.apps?.length) {
          setApps(data.apps);
          const names = data.apps.map((a) => a.name);
          if (!selectedApp || !names.includes(selectedApp)) {
            setSelectedApp(data.apps[0].name);
          }
        }
      })
      .catch(() => null);
    // selectedApp/setSelectedApp from store are stable; intentionally not in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              <DropdownMenuItem disabled className="text-[#86868B]">
                No apps connected
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-black/[0.06]" />
            <DropdownMenuItem asChild>
              <Link
                href="/settings"
                className="cursor-pointer text-[#0A84FF] focus:bg-black/[0.04] focus:text-[#0A84FF]"
              >
                + Connect another app
              </Link>
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

      {/* Account menu (real — opens dropdown with profile + settings + sign out) */}
      <div className="border-t border-black/[0.06] px-3 py-2.5 dark:border-white/[0.06]">
        <UserMenu variant="row" />
      </div>
    </aside>
  );
}
