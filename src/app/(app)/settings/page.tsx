import { PageHeader } from "@/components/layout/page-header";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";

export default function SettingsPage() {
  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage integrations, reply workflows, alert routing, and workspace defaults."
      />

      <div className="mx-auto w-full max-w-[1000px] p-4 md:p-6">
        <SettingsTabs />
      </div>
    </div>
  );
}
