"use client";

import { ReactNode, useState } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { TopNavigation } from "@/components/layout/top-navigation";
import { InboxRouter } from "@/components/layout/inbox-router";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--rb-bg-canvas)]">
      {/* Desktop sidebar — sticky, full height, independent scroll */}
      <Sidebar className="hidden md:flex" />

      {/* Mobile sidebar — sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-[260px] border-0 bg-[#0f1117] p-0"
          showCloseButton={false}
        >
          <Sidebar className="w-full border-r-0" />
        </SheetContent>
      </Sheet>

      {/* Main content — scrolls independently.
          scrollbar-gutter:stable reserves the scrollbar's width on every page,
          scrolling or not. Without it a short page (Reply Kit) renders ~15px
          wider than a scrolling one (Dashboard), so the top bar and its centred
          search box visibly jump size and position as you move between screens. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto [scrollbar-gutter:stable]">
        <TopNavigation onOpenSidebar={() => setSidebarOpen(true)} />
        <InboxRouter />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
