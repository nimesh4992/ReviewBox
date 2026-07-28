import { PageHeader } from "@/components/layout/page-header";
import { AutomationHub } from "@/features/automations/components/automation-hub";

export default function AutomationsPage() {
  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Reviews"
        title="Automation hub"
        description="Set rules to auto-reply, tag, and escalate reviews without manual effort."
      />
      <div className="p-4 md:p-6">
        <AutomationHub />
      </div>
    </div>
  );
}
