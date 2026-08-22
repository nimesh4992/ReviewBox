"use client";

import { useCallback, useState, useEffect } from "react";
import { Hash, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/api-error-message";
import { cn } from "@/lib/utils";
import { LoadErrorState } from "@/components/load-error-state";
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
    <span className="whitespace-nowrap rounded-full border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-2 py-0.5 text-[10px] text-fg-3">
      {label}
    </span>
  );
}

export function AlertPreferences() {
  const [prefs, setPrefs] = useState<AlertPreference[]>(mockAlertPreferences);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * `mockAlertPreferences` is the seed for this component's state, which makes
   * a failed read the most expensive kind of silent failure in the settings
   * area: the screen renders **the defaults from a fixture file** as though
   * they were the customer's saved choices.
   *
   * The old code checked `res.ok` — and then did nothing with the answer. Both
   * the failure path and the "no rows yet" path `return`ed, leaving the seed on
   * screen. Two states that must not look alike:
   *
   *   • **no rows yet** — a real workspace that has never opened this page.
   *     Showing the defaults is correct; they are what the backend will apply.
   *   • **the read failed** — we do not know what they chose. Showing defaults
   *     invites them to press Save, which writes the fixture over whatever they
   *     actually had.
   *
   * So the second now renders a failure with a retry, and Save is unreachable
   * until the read succeeds.
   */
  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await fetch("/api/settings/alerts");
      if (!res.ok) throw new Error(`alert preferences load failed: ${res.status}`);
      const data = (await res.json()) as { preferences?: unknown[] };
      if (!Array.isArray(data?.preferences) || data.preferences.length === 0) return;
      // Map DB snake_case rows → AlertPreference, filling any null columns with safe defaults
      const mapped: AlertPreference[] = data.preferences.map((row) => {
        const r = row as Record<string, unknown>;
        const channels = (r.channels && typeof r.channels === "object" && !Array.isArray(r.channels))
          ? r.channels as AlertPreference["channels"]
          : { email: true, slack: false };
        return {
          type:               (r.type              as AlertPreference["type"]) ?? "urgent_review",
          label:              (r.label             as string) ?? "",
          description:        (r.description       as string) ?? "",
          enabled:            (r.enabled           as boolean) ?? false,
          channels,
          scheduleTime:       (r.scheduleTime ?? r.schedule_time)       as string | undefined,
          scheduleDayOfWeek:  (r.scheduleDayOfWeek ?? r.schedule_day_of_week)  as number | undefined,
          scheduleDayOfMonth: (r.scheduleDayOfMonth ?? r.schedule_day_of_month) as number | undefined,
        };
      });
      setPrefs(mapped);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPreferences(); }, [loadPreferences]);

  async function savePreferences() {
    setSaving(true);
    setSaveError(null);
    try {
      // The response was previously never inspected, so a rejected save still
      // showed "Preferences saved" and the user only found out on reload.
      const res = await fetch("/api/settings/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setSaveError(apiErrorMessage(body, "Could not save your alert preferences."));
        return;
      }

      const ts = Date.now();
      setSavedAt(ts);
      // Clear the success message after 2 seconds
      setTimeout(() => setSavedAt((prev) => (prev === ts ? null : prev)), 2000);
    } catch {
      setSaveError("Could not reach the server. Check your connection and try again.");
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
    <div className="overflow-hidden rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-[var(--rb-border-1)] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-fg-1">
            Alert preferences
          </h2>
          <p className="mt-0.5 text-xs text-fg-3">
            Choose when and how ReviewBox notifies you.
          </p>
        </div>
      </div>

      {/* The read failed, so what is in `prefs` is the fixture seed, not the
          customer's choices. Render the failure instead — and note that Save is
          gone with it, which is the half that prevents data loss. */}
      {loadFailed ? (
        <LoadErrorState
          subject="your alert preferences"
          onRetry={() => void loadPreferences()}
          retrying={loading}
          compact
        />
      ) : (
      <>

      {/* Success toast */}
      {savedAt !== null && (
        <div
          key={savedAt}
          className="mx-5 mt-4 rounded-lg border border-[var(--rb-green-500)]/25 bg-[var(--rb-green-500)]/10 px-4 py-2 text-sm font-medium text-[var(--rb-green-500)] animate-in fade-in duration-200"
        >
          Preferences saved
        </div>
      )}

      {/* Save failure — stays until the next attempt, so it can't be missed */}
      {saveError !== null && (
        <div
          role="alert"
          className="mx-5 mt-4 rounded-lg border border-[var(--rb-red-500)]/25 bg-[var(--rb-red-500)]/10 px-4 py-2 text-sm font-medium text-[var(--rb-red-500)]"
        >
          {saveError}
        </div>
      )}

      {/* Alert rows */}
      <div className="divide-y divide-[var(--rb-border-1)]">
        {prefs.map((pref) => {
          // Guard: channels may be null if the DB row pre-dates the schema migration
          const ch = (pref.channels && typeof pref.channels === "object" && !Array.isArray(pref.channels))
            ? pref.channels
            : { email: true, slack: false } as AlertPreference["channels"];
          return (
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
                  pref.enabled ? "bg-[#0A84FF]" : "bg-[var(--rb-border-3)]",
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
                <p className="text-sm font-semibold text-fg-1">
                  {pref.label}
                </p>
                <p className="mt-0.5 text-xs text-fg-3">
                  {pref.description}
                </p>

                {/* Slack webhook input */}
                {ch.slack && (
                  <input
                    type="url"
                    value={ch.slackWebhookUrl ?? ""}
                    onChange={(e) =>
                      updateSlackWebhook(pref.type, e.target.value)
                    }
                    placeholder="https://hooks.slack.com/services/..."
                    className="mt-2 w-full rounded-lg border border-[var(--rb-border-2)] bg-[var(--rb-bg-sunken)] px-3 py-2 text-xs text-fg-1 placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/20"
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
                    ch.email
                      ? "border-[#0A84FF]/25 bg-[#0A84FF]/10 text-[#0A84FF]"
                      : "border-[var(--rb-border-2)] bg-[var(--rb-bg-sunken)] text-fg-3",
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
                    ch.slack
                      ? "border-[#0A84FF]/25 bg-[#0A84FF]/10 text-[#0A84FF]"
                      : "border-[var(--rb-border-2)] bg-[var(--rb-bg-sunken)] text-fg-3",
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
          );
        })}
      </div>

      {/* Save button */}
      <div className="flex items-center justify-end border-t border-[var(--rb-border-1)] px-5 py-4">
        <Button onClick={savePreferences} disabled={saving || loading} size="sm">
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </div>

      </>
      )}
    </div>
  );
}
