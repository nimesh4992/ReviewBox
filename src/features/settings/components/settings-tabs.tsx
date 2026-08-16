"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  Database,
  Plug,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertPreferences } from "./alert-preferences";
import { AppConnections } from "./app-connections";
import { AppFollowImport } from "./appfollow-import";
import { SlackIntegration } from "./slack-integration";
import { SupportSection } from "./support-section";
import { TagLabelSettings } from "./tag-labels";
import { TeamMembers } from "./team-members";
import { WorkspaceDefaults } from "./settings-sections";
import { DangerZone } from "@/components/settings/danger-zone";

/**
 * Settings, split into tabs.
 *
 * Nine cards on one scrolling page meant everything below the fold was
 * invisible, and the two-column layout left the right rail empty for most of
 * the scroll. Tabs fix both, but they also *hide* content — so the tab is
 * reflected in `?tab=`, and the places that link into Settings meaning a
 * specific thing ("Link account", "Connect app", "Profile & team") point at
 * the tab they mean. Without that, tabs would be a regression: those links
 * would land on General and leave the user hunting.
 */

const TABS = [
  { id: "general",      label: "General",      icon: SlidersHorizontal },
  { id: "alerts",       label: "Alerts",       icon: Bell },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "team",         label: "Team",         icon: Users },
  { id: "data",         label: "Data",         icon: Database },
] as const;

type TabId = (typeof TABS)[number]["id"];
const DEFAULT_TAB: TabId = "general";

function isTabId(v: string | null): v is TabId {
  return !!v && TABS.some((t) => t.id === v);
}

function SettingsTabsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("tab");
  const active: TabId = isTabId(raw) ? raw : DEFAULT_TAB;

  function handleChange(next: string) {
    // replace() not push() — flipping tabs shouldn't fill the back button,
    // but the URL still deep-links and survives a refresh.
    const q = new URLSearchParams(params.toString());
    if (next === DEFAULT_TAB) q.delete("tab");
    else q.set("tab", next);
    const qs = q.toString();
    router.replace(qs ? `/settings?${qs}` : "/settings", { scroll: false });
  }

  return (
    <Tabs value={active} onValueChange={handleChange} className="gap-6">
      <TabsList
        variant="line"
        className="h-auto w-full justify-start gap-1 overflow-x-auto overflow-y-hidden border-b border-[var(--rb-border-1)] pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((t) => (
          <TabsTrigger
            key={t.id}
            value={t.id}
            className="flex-none gap-1.5 px-3 pb-2.5 text-[13px] data-[state=active]:text-[#0A84FF] data-[state=active]:after:bg-[#0A84FF]"
          >
            <t.icon className="size-3.5" strokeWidth={1.5} />
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* General — the workspace-wide settings that used to sit in a right
          rail that ran out of content halfway down the page. */}
      <TabsContent value="general" className="max-w-[560px] space-y-4">
        <WorkspaceDefaults />
        <TagLabelSettings />
      </TabsContent>

      <TabsContent value="alerts">
        <AlertPreferences />
      </TabsContent>

      <TabsContent value="integrations" className="space-y-4">
        <SlackIntegration />
        <AppConnections />
        <AppFollowImport />
      </TabsContent>

      <TabsContent value="team">
        <TeamMembers />
      </TabsContent>

      <TabsContent value="data" className="space-y-4">
        <SupportSection />
        <DangerZone />
      </TabsContent>
    </Tabs>
  );
}

export function SettingsTabs() {
  // useSearchParams needs a Suspense boundary to avoid opting the whole route
  // into client-side rendering.
  return (
    <Suspense fallback={null}>
      <SettingsTabsInner />
    </Suspense>
  );
}
