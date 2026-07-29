import { PageHeader } from "@/components/layout/page-header";
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
      />

      <div className="mx-auto grid w-full max-w-[1160px] gap-4 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <SettingsSections />
          <DangerZone />
        </div>
        <WorkspaceDefaults />
      </div>
    </div>
  );
}
