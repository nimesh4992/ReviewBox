import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { AutomationHub } from "@/features/automations/components/automation-hub";
import { Plus } from "lucide-react";

export default function AutomationsPage() {
  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Reviews"
        title="Automation hub"
        description="Set rules to auto-reply, tag, and escalate reviews without manual effort."
        actions={
          <Button size="sm" className="h-8">
            <Plus className="size-3.5" />
            Add rule
          </Button>
        }
      />
      <div className="p-4 md:p-6">
        <AutomationHub />
      </div>
    </div>
  );
}
