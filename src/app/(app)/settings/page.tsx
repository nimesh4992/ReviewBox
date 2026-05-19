import { KeyRound } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  SettingsSections,
  WorkspaceDefaults,
} from "@/features/settings/components/settings-sections";
import { DangerZone } from "@/components/settings/danger-zone";

export default function SettingsPage() {
  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage integrations, reply workflows, alert routing, and workspace defaults."
        actions={
          <Button size="sm" className="h-8">
            <KeyRound className="size-3.5" />
            Manage access
          </Button>
        }
      />

      <div className="grid gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <SettingsSections />
          <DangerZone />
        </div>
        <WorkspaceDefaults />
      </div>
    </div>
  );
}
