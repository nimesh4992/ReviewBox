"use client";

import { useCallback, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadErrorState } from "@/components/load-error-state";
import { Skeleton } from "@/components/ui/skeleton";

type SaveState = "idle" | "saving" | "saved" | "error";
type LoadState = "loading" | "ready" | "error";

function saveButtonLabel(state: SaveState, idleLabel: string): string {
  if (state === "saving") return "Saving…";
  if (state === "saved") return "Saved ✓";
  if (state === "error") return "Retry";
  return idleLabel;
}

export function WorkspaceDefaults() {
  const [supportEmail, setSupportEmail] = useState("");
  const [brandVoice,   setBrandVoice]   = useState("");
  const [load,      setLoad]      = useState<LoadState>("loading");
  const [emailSave, setEmailSave] = useState<SaveState>("idle");
  const [voiceSave, setVoiceSave] = useState<SaveState>("idle");

  /**
   * A failed load must not render as an empty form.
   *
   * `/api/settings/workspace` answers a 500 with a JSON error envelope, so
   * `res.json()` RESOLVES and the old `.catch()` never ran. Both fields were
   * set to `""` and the screen said, in effect, "you have never configured a
   * support email or a brand voice" — with the amber "Without this, AI uses a
   * generic voice" hint underneath to make the lie persuasive.
   *
   * The display bug was the smaller half. Save sends whatever is in the box,
   * so a customer who typed into that empty field would have **overwritten
   * their real brand voice with the guess they made after being told they had
   * none**. That is why this renders a failure and no form at all, rather than
   * a form with a warning: there is nothing safe to type into.
   */
  const loadSettings = useCallback(async () => {
    setLoad("loading");
    try {
      const res = await fetch("/api/settings/workspace");
      if (!res.ok) throw new Error(`settings load failed: ${res.status}`);
      const d = (await res.json()) as { supportEmail?: string; brandVoice?: string };
      setSupportEmail(d.supportEmail ?? "");
      setBrandVoice(d.brandVoice ?? "");
      setLoad("ready");
    } catch {
      setLoad("error");
    }
  }, []);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  if (load === "loading") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--rb-border-1)] bg-surface p-4 shadow-[var(--rb-shadow-xs)]">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-3 h-8 w-full" />
        </div>
        <div className="rounded-xl border border-[var(--rb-border-1)] bg-surface p-4 shadow-[var(--rb-shadow-xs)]">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-20 w-full" />
        </div>
      </div>
    );
  }

  if (load === "error") {
    return (
      <div className="rounded-xl border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
        <LoadErrorState
          subject="your workspace defaults"
          onRetry={() => void loadSettings()}
          compact
        />
      </div>
    );
  }

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
    <div className="space-y-4">
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
    </div>
  );
}
