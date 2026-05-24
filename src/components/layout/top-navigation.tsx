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
    // Reviews page reads ?search= as a server-side filter. Until we add a
    // proper command palette (Cmd+K), this is the search UX.
    router.push(`/reviews?search=${encodeURIComponent(q)}`);
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

      {/* Centre — search box (submits to /reviews?search=...) */}
      <form
        onSubmit={handleSearchSubmit}
        className="mx-auto hidden w-[280px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 h-8 md:flex dark:border-white/[0.08] dark:bg-white/[0.04]"
      >
        <Search className="size-3.5 shrink-0 text-gray-400" strokeWidth={1.5} />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search reviews…"
          className="flex-1 border-0 bg-transparent text-[13px] text-gray-800 placeholder:text-gray-400 outline-none dark:text-[#F5F5F7] dark:placeholder:text-[#636366]"
        />
      </form>

      {/* Right — Connect app CTA, dark-mode toggle, account menu */}
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/settings">
          <button className="flex h-8 items-center gap-1.5 rounded-lg bg-[#0A84FF] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#006EE0]">
            <Plus className="size-3.5" strokeWidth={2.5} />
            <span className="hidden sm:inline">Connect app</span>
          </button>
        </Link>

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

        <UserMenu variant="avatar" />
      </div>
    </header>
  );
}
