import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertPreferences } from "./alert-preferences";
import { AppConnections } from "./app-connections";
import { DataPrivacySection } from "./data-privacy-section";

export function SettingsSections() {
  return (
    <div className="flex flex-col gap-4">
      <AlertPreferences />
      <AppConnections />
      <DataPrivacySection />
    </div>
  );
}

export function WorkspaceDefaults() {
  return (
    <aside className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Workspace defaults</h2>
        <p className="mt-0.5 text-xs text-gray-400">Applied across all connected apps</p>
        <div className="mt-4 space-y-3.5">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Reply SLA</span>
            <Input
              defaultValue="4 business hours"
              className="mt-1.5 h-8 border-gray-200 bg-gray-50 text-sm text-gray-700 focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Critical rating floor</span>
            <Input
              defaultValue="2 stars"
              className="mt-1.5 h-8 border-gray-200 bg-gray-50 text-sm text-gray-700 focus:bg-white"
            />
          </label>
        </div>
        <Button className="mt-4 h-8 w-full" size="sm">
          Save defaults
        </Button>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
        <h3 className="text-sm font-semibold text-indigo-900">AI settings</h3>
        <p className="mt-0.5 text-xs text-indigo-600/70">
          Configure tone, language, and suggestion behavior
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 h-7 w-full border-indigo-200 bg-white text-xs text-indigo-700 hover:bg-indigo-50"
        >
          Configure AI preferences
        </Button>
      </div>
    </aside>
  );
}
