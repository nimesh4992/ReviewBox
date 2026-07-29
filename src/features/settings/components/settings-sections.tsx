"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertPreferences } from "./alert-preferences";
import { AppConnections } from "./app-connections";
import { SlackIntegration } from "./slack-integration";
import { SupportSection } from "./support-section";
import { TeamMembers } from "./team-members";
import { AppFollowImport } from "./appfollow-import";

/**
 * Anchor nav for the settings page. Nine stacked cards is a scroll wall with
 * no way to tell what's below the fold — these jump links give the page a
 * table of contents without restructuring it into tabs.
 */
const SECTIONS = [
  { id: "alerts",      label: "Alerts"      },
  { id: "slack",       label: "Slack"       },
  { id: "team",        label: "Team"        },
  { id: "apps",        label: "Apps"        },
  { id: "import",      label: "Import"      },
  { id: "support",     label: "Support"     },
  { id: "danger-zone", label: "Danger zone" },
] as const;

function SectionNav() {
  return (
    <nav
      aria-label="Settings sections"
      className="sticky top-0 z-10 -mx-1 mb-1 flex flex-wrap gap-1 bg-canvas/85 px-1 py-2 backdrop-blur"
    >
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="rounded-full border border-[var(--rb-border-1)] bg-surface px-3 py-1 text-[12px] font-medium text-fg-2 transition-colors hover:border-[#0A84FF]/40 hover:text-[#0A84FF]"
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

/** scroll-mt keeps a jumped-to card clear of the sticky nav above it. */
function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      {children}
    </section>
  );
}

export function SettingsSections() {
  return (
    <div className="flex flex-col gap-4">
      <SectionNav />
      <Section id="alerts"><AlertPreferences /></Section>
      <Section id="slack"><SlackIntegration /></Section>
      <Section id="team"><TeamMembers /></Section>
      <Section id="apps"><AppConnections /></Section>
      <Section id="import"><AppFollowImport /></Section>
      <Section id="support"><SupportSection /></Section>
    </div>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

function saveButtonLabel(state: SaveState, idleLabel: string): string {
  if (state === "saving") return "Saving…";
  if (state === "saved") return "Saved ✓";
  if (state === "error") return "Retry";
  return idleLabel;
}

export function WorkspaceDefaults() {
  const [supportEmail, setSupportEmail] = useState("");
  const [brandVoice,   setBrandVoice]   = useState("");
  const [emailSave, setEmailSave] = useState<SaveState>("idle");
  const [voiceSave, setVoiceSave] = useState<SaveState>("idle");

  // Load current values on mount
  useEffect(() => {
    fetch("/api/settings/workspace")
      .then((r) => r.json())
      .then((d: { supportEmail?: string; brandVoice?: string }) => {
        setSupportEmail(d.supportEmail ?? "");
        setBrandVoice(d.brandVoice ?? "");
      })
      .catch(() => undefined);
  }, []);

  // Each card saves only its own field — saving the support email must not
  // touch the brand voice, and vice versa.
  async function saveField(
    payload: { supportEmail: string } | { brandVoice: string },
    setState: (s: SaveState) => void,
  ) {
    setState("saving");
    try {
      const res = await fetch("/api/settings/workspace", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save failed");
      setState("saved");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
    }
  }

  return (
    <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
      {/* Workspace defaults card */}
      <div className="rounded-xl border border-[var(--rb-border-1)] bg-surface p-4 shadow-[var(--rb-shadow-xs)]">
        <h2 className="text-sm font-semibold text-fg-1">Workspace defaults</h2>
        <p className="mt-0.5 text-xs text-fg-3">Applied across all connected apps</p>
        <div className="mt-4 space-y-3.5">
          <label className="block">
            <span className="text-xs font-medium text-fg-2">Support email</span>
            <Input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="support@yourapp.com"
              className="mt-1.5 h-8 text-sm"
            />
            <span className="mt-1 block text-[11px] text-fg-3">
              Shown in AI reply suggestions and escalation templates.
            </span>
          </label>
        </div>
        {emailSave === "error" && (
          <p className="mt-2 text-xs text-[var(--rb-red-500)]">Couldn&apos;t save — try again.</p>
        )}
        <Button
          className="mt-4 h-8 w-full"
          size="sm"
          onClick={() => void saveField({ supportEmail }, setEmailSave)}
          disabled={emailSave === "saving"}
        >
          {saveButtonLabel(emailSave, "Save defaults")}
        </Button>
      </div>

      {/* Brand voice card — the #1 AI quality lever */}
      <div className="rounded-xl border border-[var(--rb-border-1)] bg-surface p-4 shadow-[var(--rb-shadow-xs)]">
        <h3 className="text-sm font-semibold text-fg-1">AI brand voice</h3>
        <p className="mt-0.5 text-xs text-fg-3">
          Tell the AI how your team sounds. 1–3 sentences. Every reply draft uses this.
        </p>
        <textarea
          value={brandVoice}
          onChange={(e) => setBrandVoice(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder={
            "e.g. We're a friendly fitness app for beginners. We reply warmly, avoid jargon, and always offer a practical next step. We never sound robotic."
          }
          className="mt-3 w-full resize-none rounded-lg border border-[var(--rb-border-2)] bg-[var(--rb-bg-sunken)] px-3 py-2 text-sm text-fg-1 placeholder:text-fg-3 focus:border-[#0A84FF] focus:outline-none focus:ring-1 focus:ring-[#0A84FF]"
        />
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-xs text-fg-3">{brandVoice.length}/500</p>
          {brandVoice.length === 0 && (
            <p className="text-xs text-[var(--rb-amber-500)]">
              Without this, AI uses a generic voice
            </p>
          )}
        </div>
        {voiceSave === "error" && (
          <p className="mt-1 text-xs text-[var(--rb-red-500)]">Couldn&apos;t save — try again.</p>
        )}
        <Button
          className="mt-3 h-8 w-full"
          size="sm"
          onClick={() => void saveField({ brandVoice }, setVoiceSave)}
          disabled={voiceSave === "saving"}
        >
          {saveButtonLabel(voiceSave, "Save brand voice")}
        </Button>
      </div>
    </aside>
  );
}
