"use client";

import { useState, useEffect } from "react";
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
  const [supportEmail, setSupportEmail] = useState("");
  const [brandVoice,   setBrandVoice]   = useState("");
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);

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

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/settings/workspace", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ supportEmail, brandVoice }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="space-y-4">
      {/* Workspace defaults card */}
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
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Support email</span>
            <Input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="support@yourapp.com"
              className="mt-1.5 h-8 border-gray-200 bg-gray-50 text-sm text-gray-700 focus:bg-white"
            />
          </label>
        </div>
        <Button
          className="mt-4 h-8 w-full"
          size="sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save defaults"}
        </Button>
      </div>

      {/* Brand voice card — the #1 AI quality lever */}
      <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">AI brand voice</h3>
        <p className="mt-0.5 text-xs text-gray-400">
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
          className="mt-3 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0A84FF]"
        />
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {brandVoice.length}/500 characters
          </p>
          {brandVoice.length === 0 && (
            <p className="text-xs text-amber-500">
              Without this, AI uses a generic voice
            </p>
          )}
        </div>
        <Button
          className="mt-3 h-8 w-full"
          size="sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save brand voice"}
        </Button>
      </div>
    </aside>
  );
}
