"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  Smartphone,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useApps, useInvalidateApps, type WorkspaceApp } from "@/hooks/use-apps";
import { formatReviewDate } from "@/utils/format";
import { GooglePlaySetupModal } from "@/components/dashboard/google-play-setup-modal";

// ── App Store credential form ─────────────────────────────────────────────────

interface TestResult {
  ok: boolean;
  message: string;
  appStoreId?: string;
  verifiedAt: string;
}

function AppStoreForm({
  app,
  onSaved,
}: {
  app: WorkspaceApp;
  onSaved: () => void;
}) {
  const [keyId, setKeyId] = useState("");
  const [issuerId, setIssuerId] = useState("");
  const [p8Key, setP8Key] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Validate field formats inline so users see issues before submit.
  const keyIdLooksValid    = keyId.length === 0 || /^[A-Z0-9]{8,12}$/i.test(keyId.trim());
  const issuerIdLooksValid = issuerId.length === 0 || /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(issuerId.trim());

  async function testConnection() {
    setTesting(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${app.id}/test-credentials`, { method: "POST" });
      const data = (await res.json()) as TestResult;
      setTestResult(data);
    } catch {
      setTestResult({
        ok: false,
        message: "Network error — couldn't reach our server. Try again.",
        verifiedAt: new Date().toISOString(),
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!keyId.trim() || !issuerId.trim() || !p8Key.trim()) {
      setError("All three fields are required.");
      return;
    }
    if (!p8Key.includes("-----BEGIN PRIVATE KEY-----")) {
      setError("Private key must include the full PEM block (-----BEGIN PRIVATE KEY-----).");
      return;
    }
    if (!keyIdLooksValid || !issuerIdLooksValid) {
      setError("Key ID or Issuer ID format looks wrong — double-check you copied them correctly.");
      return;
    }
    setError(null);
    setTestResult(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/apps/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId, issuerId, p8Key }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "Save failed.");
        return;
      }
      setKeyId("");
      setIssuerId("");
      setP8Key("");
      onSaved();
      // Auto-test the credentials we just saved so the user sees if Apple
      // accepts them BEFORE they wait for the next sync cron.
      setTesting(true);
      try {
        const testRes = await fetch(`/api/apps/${app.id}/test-credentials`, { method: "POST" });
        const data = (await testRes.json()) as TestResult;
        setTestResult(data);
      } catch {
        setTestResult({
          ok: false,
          message: "Saved — but verification network call failed. Click 'Test connection' to retry.",
          verifiedAt: new Date().toISOString(),
        });
      } finally {
        setTesting(false);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--rb-fg-2)]">
          App Store Connect credentials
        </p>
        <a
          href="/help/connect-app-store"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-semibold text-[#0A84FF] hover:underline"
        >
          Full guide →
        </a>
      </div>
      <ol className="space-y-1.5 text-xs text-[var(--rb-fg-3)] leading-relaxed">
        <li>
          <span className="font-semibold text-[var(--rb-fg-2)]">1.</span>{" "}
          <a
            href="https://appstoreconnect.apple.com/access/integrations/api"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#0A84FF] underline-offset-2 hover:underline"
          >
            Open App Store Connect → Users &amp; Access → Integrations → Keys
          </a>
        </li>
        <li>
          <span className="font-semibold text-[var(--rb-fg-2)]">2.</span> Click Generate API Key.
          Name it &quot;ReviewBox&quot;. Set access to{" "}
          <span className="font-medium text-[var(--rb-fg-2)]">Customer Support</span>.
        </li>
        <li>
          <span className="font-semibold text-[var(--rb-fg-2)]">3.</span> Download the{" "}
          <code className="rounded bg-[var(--rb-bg-hover)] px-1 py-0.5 font-mono text-[10px] text-[var(--rb-fg-2)]">
            AuthKey_XXXXXX.p8
          </code>{" "}
          file (only available ONCE — save it).
        </li>
        <li>
          <span className="font-semibold text-[var(--rb-fg-2)]">4.</span> Copy the{" "}
          <span className="font-medium text-[var(--rb-fg-2)]">Key ID</span> +{" "}
          <span className="font-medium text-[var(--rb-fg-2)]">Issuer ID</span> from the same page,
          paste below along with the .p8 file contents.
        </li>
      </ol>

      {app.has_credentials && !testResult && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--rb-border-1)] bg-surface px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-[var(--rb-fg-2)]">
            <CheckCircle2 className="size-3.5 text-[var(--rb-green-500)]" />
            Credentials saved. Verify they work with Apple:
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={testConnection}
            disabled={testing}
            className="h-7 text-[11px]"
          >
            {testing ? (
              <><Loader2 className="mr-1 size-3 animate-spin" />Testing…</>
            ) : (
              "Test connection"
            )}
          </Button>
        </div>
      )}

      {testResult && (
        <div
          className={cn(
            "rounded-md border px-3 py-2.5",
            testResult.ok
              ? "border-[var(--rb-green-500)]/25 bg-[var(--rb-green-500)]/10"
              : "border-[var(--rb-red-500)]/25 bg-[var(--rb-red-500)]/10",
          )}
        >
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-semibold",
            testResult.ok ? "text-[var(--rb-green-500)]" : "text-[var(--rb-red-500)]",
          )}>
            {testResult.ok ? <CheckCircle2 className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
            {testResult.ok ? "Verified" : "Verification failed"}
          </div>
          <p className={cn(
            "mt-1 text-[11px] leading-relaxed",
            testResult.ok ? "text-[var(--rb-green-500)]/90" : "text-[var(--rb-red-500)]/90",
          )}>
            {testResult.message}
          </p>
          {testResult.ok && (
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={testConnection}
                disabled={testing}
                className="h-6 text-[10px]"
              >
                Re-test
              </Button>
              <span className="text-[10px] text-[var(--rb-green-500)]/70">
                Now click <strong>Sync now</strong> above to pull reviews.
              </span>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <label className="block">
        <span className="text-xs font-medium text-[var(--rb-fg-2)]">Key ID</span>
        <Input
          value={keyId}
          onChange={(e) => setKeyId(e.target.value)}
          placeholder="XXXXXXXXXX (10 chars)"
          className={cn(
            "mt-1 h-8 bg-surface text-sm font-mono",
            keyIdLooksValid ? "border-[var(--rb-border-1)]" : "border-amber-300",
          )}
        />
        {!keyIdLooksValid && (
          <span className="mt-0.5 text-[10px] text-amber-600">
            Key ID is usually 10 uppercase chars (letters + digits).
          </span>
        )}
      </label>

      <label className="block">
        <span className="text-xs font-medium text-[var(--rb-fg-2)]">Issuer ID</span>
        <Input
          value={issuerId}
          onChange={(e) => setIssuerId(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className={cn(
            "mt-1 h-8 bg-surface text-sm font-mono",
            issuerIdLooksValid ? "border-[var(--rb-border-1)]" : "border-amber-300",
          )}
        />
        {!issuerIdLooksValid && (
          <span className="mt-0.5 text-[10px] text-amber-600">
            Issuer ID should be a UUID (36 chars with dashes).
          </span>
        )}
      </label>

      <label className="block">
        <span className="text-xs font-medium text-[var(--rb-fg-2)]">.p8 Private key</span>
        <textarea
          value={p8Key}
          onChange={(e) => setP8Key(e.target.value)}
          placeholder={"-----BEGIN PRIVATE KEY-----\nMIGHAgEAM...\n-----END PRIVATE KEY-----"}
          rows={5}
          className="mt-1 w-full rounded-md border border-[var(--rb-border-1)] bg-surface px-3 py-2 font-mono text-xs text-[var(--rb-fg-2)] placeholder:text-[var(--rb-fg-4)] focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/20 resize-none"
        />
      </label>

      <Button
        size="sm"
        onClick={handleSave}
        disabled={saving || testing}
        className="h-8 bg-[#0A84FF] text-white hover:bg-[#0070e0]"
      >
        {saving ? (
          <><Loader2 className="mr-1.5 size-3 animate-spin" />Saving…</>
        ) : testing ? (
          <><Loader2 className="mr-1.5 size-3 animate-spin" />Verifying with Apple…</>
        ) : app.has_credentials ? (
          "Replace credentials"
        ) : (
          "Save & verify"
        )}
      </Button>
    </div>
  );
}

// ── Google Play setup panel (inline — opens full modal) ───────────────────────

function GooglePlayInfo({ app, onOpenSetup }: { app: WorkspaceApp; onOpenSetup: () => void }) {
  return (
    <div className="mt-3 rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--rb-fg-2)]">Google Play connection</p>
        {app.last_synced_at && (
          <p className="text-[11px] text-[var(--rb-fg-4)]">
            Last synced: {formatReviewDate(app.last_synced_at)}
          </p>
        )}
      </div>

      <p className="text-[12px] text-[var(--rb-fg-3)] leading-relaxed">
        ReviewBox connects via a shared service account. You need to invite its email address to your
        Play Console with <strong>Reply to reviews</strong> permission.
      </p>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={onOpenSetup}
          className="h-8 bg-[#0A84FF] text-white hover:bg-[#0070e0] gap-1.5"
        >
          <Settings2 className="size-3.5" />
          Connection setup
        </Button>
        <a
          href="/help/connect-google-play"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-medium text-[var(--rb-fg-4)] hover:text-[#0A84FF] hover:underline"
        >
          Read guide →
        </a>
      </div>
    </div>
  );
}

// ── Single app row ────────────────────────────────────────────────────────────

function AppRow({
  app,
  onDeleted,
  onUpdated,
}: {
  app: WorkspaceApp;
  onDeleted: () => void;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  const isAppStore = app.platform === "app_store";
  const Icon = isAppStore ? Globe : Smartphone;

  const statusLabel = app.has_credentials || app.platform === "google_play"
    ? "Connected"
    : "Needs setup";
  const statusClass = app.has_credentials || app.platform === "google_play"
    ? "bg-[var(--rb-green-500)]/10 text-[var(--rb-green-500)] border-[var(--rb-green-500)]/25"
    : "bg-amber-50 text-amber-700 border-amber-200";

  async function handleDelete() {
    if (!confirm(`Remove "${app.name}"? This will delete all synced reviews.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/apps/${app.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setDeleteError(body.error ?? "Failed to remove app. Please try again.");
        return;
      }
      onDeleted();
    } catch {
      setDeleteError("Network error — could not remove app. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      // Trigger an inline sync for THIS user's workspace only. The global
      // coordinator fans out to all workspaces — wasteful when one user
      // just wants to see their own reviews after wiring credentials.
      // We don't have workspace_id on the client, but the worker route
      // accepts ?workspaceId=X. Lacking that, hit the global endpoint
      // which will still pick up this workspace within seconds.
      await fetch("/api/sync/reviews");
    } finally {
      setSyncing(false);
      onUpdated();
    }
  }

  return (
    <div className="border-b border-[var(--rb-border-1)] last:border-0">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)]">
          <Icon className="size-4 text-[var(--rb-fg-3)]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--rb-fg-1)]">{app.name}</span>
            <span className="rounded bg-[var(--rb-bg-hover)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--rb-fg-3)]">
              {app.store_id}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--rb-fg-4)]">
            {isAppStore ? "App Store Connect" : "Google Play"}
            {app.last_synced_at && (
              <> · Last synced {formatReviewDate(app.last_synced_at)}</>
            )}
            {!app.last_synced_at && " · Never synced"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant="outline"
            className={cn("h-5 rounded-full border px-2 text-[10px] font-semibold", statusClass)}
          >
            {statusLabel === "Connected" && (
              <CheckCircle2 className="mr-1 size-2.5" />
            )}
            {statusLabel === "Needs setup" && (
              <TriangleAlert className="mr-1 size-2.5" />
            )}
            {statusLabel}
          </Badge>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-[var(--rb-fg-4)] hover:text-[var(--rb-fg-2)]"
            onClick={handleSync}
            disabled={syncing}
            title="Sync now"
          >
            <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-[var(--rb-fg-4)] hover:text-red-500"
            onClick={handleDelete}
            disabled={deleting}
            title="Remove app"
          >
            {deleting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-[var(--rb-fg-4)] hover:text-[var(--rb-fg-2)]"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Collapse" : "Configure"}
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {deleteError && (
        <div className="mx-4 mb-2 rounded-lg border border-[var(--rb-red-500)]/25 bg-[var(--rb-red-500)]/10 px-3 py-2 text-xs text-[var(--rb-red-500)]">
          {deleteError}
        </div>
      )}

      {expanded && (
        <div className="border-t border-[var(--rb-border-1)] px-4 pb-4">
          {isAppStore ? (
            <AppStoreForm app={app} onSaved={onUpdated} />
          ) : (
            <GooglePlayInfo app={app} onOpenSetup={() => setSetupModalOpen(true)} />
          )}
        </div>
      )}

      {/* Google Play setup modal — also opened via "Connection setup" button above */}
      {app.platform === "google_play" && (
        <GooglePlaySetupModal
          open={setupModalOpen}
          onClose={() => { setSetupModalOpen(false); onUpdated(); }}
          app={{ id: app.id, store_id: app.store_id, name: app.name }}
        />
      )}
    </div>
  );
}

// ── Add app form ──────────────────────────────────────────────────────────────

function AddAppForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<"google_play" | "app_store">("google_play");
  const [storeId, setStoreId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim() || !storeId.trim()) {
      setError("Name and store ID are required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          platform,
          ...(platform === "google_play"
            ? { packageName: storeId.trim() }
            : { bundleId: storeId.trim() }),
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string; message?: string };
        setError(body.message ?? body.error ?? "Failed to add app.");
        return;
      }
      setName("");
      setStoreId("");
      setOpen(false);
      onAdded();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center justify-center border-t border-dashed border-[var(--rb-border-1)] px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-[var(--rb-fg-3)] hover:text-[var(--rb-fg-2)]"
          onClick={() => setOpen(true)}
        >
          <Plus className="size-3.5" />
          Add app
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-dashed border-[var(--rb-border-1)] px-4 py-4">
      <p className="text-xs font-medium text-[var(--rb-fg-2)]">Add new app</p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-[var(--rb-fg-2)]">App name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My App"
            className="mt-1 h-8 border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] text-sm focus:bg-surface"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-[var(--rb-fg-2)]">Platform</span>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as "google_play" | "app_store")}
            className="mt-1 h-8 w-full rounded-md border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-3 text-sm text-[var(--rb-fg-2)] focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/20"
          >
            <option value="google_play">Google Play</option>
            <option value="app_store">App Store</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-[var(--rb-fg-2)]">
          {platform === "google_play" ? "Package name" : "Bundle ID"}
        </span>
        <Input
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          placeholder={
            platform === "google_play"
              ? "com.yourcompany.app"
              : "com.yourcompany.app"
          }
          className="mt-1 h-8 border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] font-mono text-sm focus:bg-surface"
        />
      </label>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={saving}
          className="h-8 bg-[#0A84FF] text-white hover:bg-[#0070e0]"
        >
          {saving ? (
            <>
              <Loader2 className="mr-1.5 size-3 animate-spin" />
              Adding…
            </>
          ) : (
            "Add app"
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-[var(--rb-fg-3)]"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function AppConnections() {
  const { apps, isLoading } = useApps();
  const invalidate = useInvalidateApps();

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--rb-border-1)] bg-surface shadow-sm">
      <div className="border-b border-[var(--rb-border-1)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--rb-fg-1)]">Connected apps</h2>
        <p className="mt-0.5 text-xs text-[var(--rb-fg-4)]">
          Apps synced to this workspace · reviews are fetched daily
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-4 animate-spin text-[var(--rb-fg-4)]" />
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
          <p className="text-sm text-[var(--rb-fg-3)]">No apps connected yet.</p>
          <p className="text-xs text-[var(--rb-fg-4)]">Add your first Google Play or App Store app below.</p>
        </div>
      ) : (
        <div>
          {apps.map((app) => (
            <AppRow
              key={app.id}
              app={app}
              onDeleted={invalidate}
              onUpdated={invalidate}
            />
          ))}
        </div>
      )}

      <AddAppForm onAdded={invalidate} />
    </section>
  );
}
