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
import { useDashboardMetrics } from "@/hooks/use-dashboard-metrics";

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
// Ordered by the core loop (D018): the inbox IS the product, so it sits
// first-class next to Dashboard instead of buried in a group. Group labels
// are verbs — what the user is doing, not a taxonomy of screens.
const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { name: "Inbox",     href: "/inbox",     icon: Inbox, signal: null },
      { name: "Dashboard", href: "/dashboard", icon: Gauge, signal: null },
    ],
  },
  {
    label: "Automate",
    items: [
      { name: "Automations", href: "/automations", icon: Workflow, signal: null },
      { name: "Reply Kit",   href: "/reply-kit",   icon: BookOpen, signal: null },
    ],
  },
  {
    label: "Monitor",
    items: [
      { name: "Sentiment",  href: "/sentiment",  icon: BarChart2,     signal: null },
      { name: "Releases",   href: "/releases",   icon: Rocket,        signal: null },
      { name: "Incidents",  href: "/incidents",  icon: AlertTriangle, signal: null },
      { name: "Reports",    href: "/reports",    icon: FileBarChart,  signal: null },
    ],
  },
  {
    label: "Grow",
    items: [
      { name: "Competitors", href: "/competitors", icon: Trophy, signal: null },
      { name: "ASO",         href: "/aso",         icon: Search, signal: null },
    ],
  },
  {
    label: null,
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
}: NavItem & { isActive: boolean }) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex h-8 items-center justify-between rounded-md px-2 text-rb-base transition-colors duration-150",
        isActive
          ? "bg-[var(--rb-bg-selected)] font-medium text-[var(--rb-blue-600)]"
          : "text-fg-2 hover:bg-[var(--rb-bg-hover)] hover:text-fg-1",
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon
          className={cn(
            "size-4 shrink-0",
            isActive ? "text-[var(--rb-blue-500)]" : "text-fg-3 group-hover:text-fg-2",
          )}
          strokeWidth={1.5}
        />
        <span className="truncate">{name}</span>
      </span>
      {signal && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-rb-xs font-medium tabular-nums",
            isActive
              ? "bg-[var(--rb-blue-100)] text-[var(--rb-blue-600)]"
              : "bg-[var(--rb-bg-hover)] text-fg-3",
          )}
        >
          {signal}
        </span>
      )}
    </Link>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface App {
  id: string;
  name: string;
  platform: string;
  icon_url?: string | null;
}

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const { selectedApp, setSelectedApp } = useWorkspaceStore();
  const [apps, setApps] = useState<App[]>([]);
  const { data: metrics } = useDashboardMetrics();
  const unrepliedCount = metrics?.unrepliedCount ?? 0;

  useEffect(() => {
    fetch("/api/apps")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { apps: App[] } | null) => {
        if (data?.apps?.length) {
          setApps(data.apps);
          // Reset to "all apps" if the persisted selection no longer exists —
          // covers a deleted app and the migration off name-based selection.
          const ids = data.apps.map((a) => a.id);
          if (selectedApp && !ids.includes(selectedApp)) {
            setSelectedApp("");
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
        "flex h-screen w-[220px] shrink-0 flex-col border-r border-[var(--rb-border-1)] bg-[var(--rb-bg-canvas)]",
        className,
      )}
    >
      {/* Logo — the "Review Intelligence" tagline came off: a product doesn't
          need to explain itself to someone already inside it. */}
      <div className="px-4 pt-4 pb-3">
        <Link href="/dashboard" className="flex w-fit items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--rb-blue-500)] text-[11px] font-bold tracking-tight text-white">
            R
          </div>
          <span className="text-rb-md font-semibold tracking-tight text-fg-1">ReviewBox</span>
        </Link>
      </div>

      {/* Demo mode — one quiet line, not a card with its own heading */}
      {isLoaded && !user?.publicMetadata?.onboarded && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-[var(--rb-amber-500)]/30 bg-[var(--rb-amber-100)]/40 px-2.5 py-1.5">
          <span className="size-1.5 shrink-0 rounded-full bg-[var(--rb-amber-500)]" />
          <span className="text-rb-xs leading-tight text-[var(--rb-amber-600)]">
            Sample data — connect your app to go live
          </span>
        </div>
      )}

      {/* App selector */}
      <div className="px-3 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-full justify-between rounded-md border border-[var(--rb-border-2)] bg-surface px-2.5 text-left text-rb-sm text-fg-2 hover:bg-[var(--rb-bg-hover)] hover:text-fg-1"
            >
              <span className="min-w-0 truncate">
                {apps.find((a) => a.id === selectedApp)?.name ?? "All apps"}
              </span>
              <ChevronDown className="size-3 shrink-0 text-fg-3" strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel className="text-rb-xs text-fg-3">
              Workspace apps
            </DropdownMenuLabel>
            {apps.length > 1 && (
              <DropdownMenuItem className="gap-2" onClick={() => setSelectedApp("")}>
                <span className="size-4 shrink-0 rounded bg-[var(--rb-bg-sunken)] text-center text-[8px] font-bold leading-4 text-fg-3">
                  ∗
                </span>
                <span className="truncate">All apps</span>
                {selectedApp === "" && <span className="ml-auto text-[var(--rb-blue-500)]">✓</span>}
              </DropdownMenuItem>
            )}
            {apps.length > 0 ? apps.map((app) => (
              <DropdownMenuItem
                key={app.id}
                className="gap-2"
                onClick={() => setSelectedApp(app.id)}
              >
                {app.icon_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={app.icon_url} alt="" className="size-4 shrink-0 rounded object-cover" />
                ) : (
                  <span className="size-4 shrink-0 rounded bg-[var(--rb-bg-sunken)] text-center text-[8px] font-bold leading-4 text-fg-3">
                    {app.name[0]?.toUpperCase()}
                  </span>
                )}
                <span className="truncate">{app.name}</span>
                {selectedApp === app.id && (
                  <span className="ml-auto text-[var(--rb-blue-500)]">✓</span>
                )}
              </DropdownMenuItem>
            )) : (
              <DropdownMenuItem disabled className="text-fg-3">
                No apps connected
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer text-[var(--rb-blue-500)]">
                + Connect another app
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mx-3 h-px bg-[var(--rb-border-1)]" />

      {/* Navigation. Groups no longer collapse — twelve items always fit, and
          the per-group chevron buttons added interaction cost with no payoff.
          Labels are plain headers; every row sits flush at the same indent. */}
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {navGroups.map((group, i) => (
          <div key={i}>
            {group.label && (
              <div className="px-2 pb-1 text-rb-xs font-medium uppercase tracking-[0.08em] text-fg-4">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const withSignal =
                  item.href === "/inbox" && unrepliedCount > 0
                    ? { ...item, signal: String(unrepliedCount) }
                    : item;
                return (
                  <SidebarNavItem
                    key={item.href}
                    {...withSignal}
                    isActive={pathname === item.href}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Account menu (real — opens dropdown with profile + settings + sign out) */}
      <div className="border-t border-[var(--rb-border-1)] px-3 py-2.5">
        <UserMenu variant="row" />
      </div>
    </aside>
  );
}
