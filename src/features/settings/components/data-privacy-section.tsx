"use client";

import { useRouter } from "next/navigation";
import { Shield, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DataPrivacySection() {
  const router = useRouter();

  async function handleExport() {
    try {
      const response = await fetch("/api/gdpr/export", { method: "POST" });
      if (!response.ok) {
        alert("Export failed. Please try again.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reviewbox-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Please try again.");
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you absolutely sure? This will permanently delete your workspace, all reviews, and your account. This action cannot be undone."
    );
    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      'Final confirmation: type OK to permanently delete your account and all associated data.'
    );
    if (!doubleConfirmed) return;

    try {
      const response = await fetch("/api/gdpr/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE MY ACCOUNT" }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        alert(`Deletion failed: ${data.error ?? "Unknown error"}`);
        return;
      }

      router.push("/");
    } catch {
      alert("Deletion failed. Please try again.");
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Data &amp; Privacy</h2>
        </div>
        <p className="mt-0.5 text-xs text-gray-400">
          Manage your data in compliance with GDPR and other privacy regulations
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Export */}
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
              <Download className="size-4 text-gray-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">Export your data</h3>
              <p className="mt-0.5 text-sm text-gray-500">
                Download a copy of all your workspace data including reviews, templates, and settings.
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-7 border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
              onClick={handleExport}
            >
              Export data
            </Button>
          </div>
        </div>

        {/* Delete */}
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-red-100 bg-red-50">
              <Trash2 className="size-4 text-red-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">Delete account</h3>
              <p className="mt-0.5 text-sm text-gray-500">
                Permanently delete your account and all associated data. This action is irreversible.
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-7 border-red-200 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleDelete}
            >
              Delete account
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
