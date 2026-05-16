"use client";

import { useState } from "react";
import { Hash, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AlertPreference, AlertType } from "@/types/review";
import { mockAlertPreferences } from "@/features/settings/data/mock-alerts";

function ScheduleBadge({ pref }: { pref: AlertPreference }) {
  let label: string | null = null;

  if (pref.type === "daily_digest") {
    label = `${pref.scheduleTime} daily`;
  } else if (pref.type === "weekly_digest") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const day =
      pref.scheduleDayOfWeek !== undefined
        ? days[pref.scheduleDayOfWeek]
        : "Mon";
    label = `${day} ${pref.scheduleTime}`;
  } else if (pref.type === "monthly_report") {
    label = "1st of month";
  }

  if (!label) return null;

  return (
    <span className="whitespace-nowrap rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-400">
      {label}
    </span>
  );
}

export function AlertPreferences() {
  const [prefs, setPrefs] = useState<AlertPreference[]>(mockAlertPreferences);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function savePreferences() {
    setSaving(true);
    try {
      await fetch("/api/settings/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const ts = Date.now();
      setSavedAt(ts);
      // Clear the success message after 2 seconds
      setTimeout(() => setSavedAt((prev) => (prev === ts ? null : prev)), 2000);
    } catch (err) {
      console.error("Failed to save alert preferences:", err);
    } finally {
      setSaving(false);
    }
  }

  function toggleAlert(type: AlertType) {
    setPrefs((p) =>
      p.map((a) => (a.type === type ? { ...a, enabled: !a.enabled } : a)),
    );
  }

  function toggleChannel(type: AlertType, channel: "email" | "slack") {
    setPrefs((p) =>
      p.map((a) =>
        a.type === type
          ? { ...a, channels: { ...a.channels, [channel]: !a.channels[channel] } }
          : a,
      ),
    );
  }

  function updateSlackWebhook(type: AlertType, url: string) {
    setPrefs((p) =>
      p.map((a) =>
        a.type === type
          ? { ...a, channels: { ...a.channels, slackWebhookUrl: url } }
          : a,
      ),
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Alert preferences
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">
            Choose when and how ReviewBox notifies you.
          </p>
        </div>
      </div>

      {/* Success toast */}
      {savedAt !== null && (
        <div
          key={savedAt}
          className="mx-5 mt-4 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-700 border border-green-200 animate-in fade-in duration-200"
        >
          Preferences saved
        </div>
      )}

      {/* Alert rows */}
      <div className="divide-y divide-gray-100">
        {prefs.map((pref) => (
          <div key={pref.type} className="px-5 py-4">
            <div className="flex items-start gap-4">
              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={pref.enabled}
                onClick={() => toggleAlert(pref.type)}
                className={cn(
                  "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors",
                  pref.enabled ? "bg-[#5B5BD6]" : "bg-gray-200",
                )}
              >
                <span
                  className={cn(
                    "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                    pref.enabled ? "translate-x-4" : "translate-x-0",
                  )}
                />
              </button>

              {/* Label + description */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">
                  {pref.label}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {pref.description}
                </p>

                {/* Slack webhook input */}
                {pref.channels.slack && (
                  <input
                    type="url"
                    value={pref.channels.slackWebhookUrl ?? ""}
                    onChange={(e) =>
                      updateSlackWebhook(pref.type, e.target.value)
                    }
                    placeholder="https://hooks.slack.com/services/..."
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5B5BD6]/20"
                  />
                )}
              </div>

              {/* Channel pills + schedule badge */}
              <div className="flex shrink-0 items-center gap-2">
                {/* Email pill */}
                <button
                  type="button"
                  onClick={() => toggleChannel(pref.type, "email")}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    pref.channels.email
                      ? "border-[#5B5BD6]/20 bg-[#5B5BD6]/10 text-[#5B5BD6]"
                      : "border-gray-200 bg-gray-100 text-gray-400",
                  )}
                >
                  <Mail className="size-3" strokeWidth={1.5} />
                  Email
                </button>

                {/* Slack pill */}
                <button
                  type="button"
                  onClick={() => toggleChannel(pref.type, "slack")}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    pref.channels.slack
                      ? "border-[#5B5BD6]/20 bg-[#5B5BD6]/10 text-[#5B5BD6]"
                      : "border-gray-200 bg-gray-100 text-gray-400",
                  )}
                >
                  <Hash className="size-3" strokeWidth={1.5} />
                  Slack
                </button>

                {/* Schedule badge */}
                <ScheduleBadge pref={pref} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="flex items-center justify-end border-t border-gray-100 px-5 py-4">
        <Button
          onClick={savePreferences}
          disabled={saving}
          size="sm"
          className="bg-[#5B5BD6] text-white hover:bg-[#4f4fbf] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
