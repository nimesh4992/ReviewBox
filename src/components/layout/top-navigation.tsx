"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, Moon, Plus, Search, Sun } from "lucide-react";

import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspaceStore } from "@/store/use-workspace-store";

interface TopNavigationProps {
  onOpenSidebar: () => void;
}

export function TopNavigation({ onOpenSidebar }: TopNavigationProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const { theme, toggleTheme } = useWorkspaceStore();

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    // The inbox seeds its filter from ?search=. (/reviews redirects to /inbox
    // and would drop the query param, so navigate straight to the inbox.)
    router.push(`/inbox?search=${encodeURIComponent(q)}`);
  }

  return (
    <header className="sticky top-0 z-30 flex h-13 items-center justify-between gap-3 border-b border-[var(--rb-border-1)] bg-[var(--rb-bg-canvas)]/80 px-4 backdrop-blur-xl backdrop-saturate-150 md:px-6">
      {/* Left — mobile menu trigger */}
      <div className="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-fg-3 hover:bg-[var(--rb-bg-hover)] md:hidden"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
        >
          <Menu className="size-4" strokeWidth={1.5} />
        </Button>
      </div>

      {/* Centre — search box (submits to /reviews?search=...) */}
      <form
        onSubmit={handleSearchSubmit}
        className="mx-auto hidden h-8 w-[280px] items-center gap-2 rounded-lg border border-[var(--rb-border-2)] bg-surface px-3 md:flex"
      >
        <Search className="size-3.5 shrink-0 text-fg-3" strokeWidth={1.5} />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search reviews…"
          className="flex-1 border-0 bg-transparent text-[13px] text-fg-1 outline-none placeholder:text-fg-3"
        />
      </form>

      {/* Right — Connect app CTA, dark-mode toggle, account menu */}
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/settings?tab=integrations">
          <button className="flex h-8 items-center gap-1.5 rounded-lg bg-[#0A84FF] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#006EE0]">
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">Connect app</span>
          </button>
        </Link>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-fg-3 hover:bg-[var(--rb-bg-hover)] hover:text-fg-1"
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

        <UserMenu variant="avatar" />
      </div>
    </header>
  );
}
