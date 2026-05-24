"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
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

// ── App Store credential form ─────────────────────────────────────────────────

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
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleSave() {
    if (!keyId.trim() || !issuerId.trim() || !p8Key.trim()) {
      setError("All three fields are required.");
      return;
    }
    if (!p8Key.includes("-----BEGIN PRIVATE KEY-----")) {
      setError("Private key must include the full PEM block (-----BEGIN PRIVATE KEY-----).");
      return;
    }
    setError(null);
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
      const ts = Date.now();
      setSavedAt(ts);
      setKeyId("");
      setIssuerId("");
      setP8Key("");
      onSaved();
      setTimeout(() => setSavedAt((prev) => (prev === ts ? null : prev)), 3000);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-600">
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
      <ol className="space-y-1.5 text-xs text-gray-500 leading-relaxed">
        <li>
          <span className="font-semibold text-gray-700">1.</span>{" "}
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
          <span className="font-semibold text-gray-700">2.</span> Click Generate API Key.
          Name it &quot;ReviewBox&quot;. Set access to{" "}
          <span className="font-medium text-gray-700">Customer Support</span>.
        </li>
        <li>
          <span className="font-semibold text-gray-700">3.</span> Download the{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[10px] text-gray-600">
            AuthKey_XXXXXX.p8
          </code>{" "}
          file (only available ONCE — save it).
        </li>
        <li>
          <span className="font-semibold text-gray-700">4.</span> Copy the{" "}
          <span className="font-medium text-gray-700">Key ID</span> +{" "}
          <span className="font-medium text-gray-700">Issuer ID</span> from the same page,
          paste below along with the .p8 file contents.
        </li>
      </ol>

      {app.has_credentials && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
          <CheckCircle2 className="size-3.5" />
          Credentials saved — enter new values below to rotate them
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      {savedAt && (
        <p className="text-xs text-emerald-600">Credentials saved successfully.</p>
      )}

      <label className="block">
        <span className="text-xs font-medium text-gray-600">Key ID</span>
        <Input
          value={keyId}
          onChange={(e) => setKeyId(e.target.value)}
          placeholder="XXXXXXXXXX"
          className="mt-1 h-8 border-gray-200 bg-white text-sm font-mono"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-gray-600">Issuer ID</span>
        <Input
          value={issuerId}
          onChange={(e) => setIssuerId(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="mt-1 h-8 border-gray-200 bg-white text-sm font-mono"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-gray-600">.p8 Private key</span>
        <textarea
          value={p8Key}
          onChange={(e) => setP8Key(e.target.value)}
          placeholder={"-----BEGIN PRIVATE KEY-----\nMIGHAgEAM...\n-----END PRIVATE KEY-----"}
          rows={5}
          className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/20 resize-none"
        />
      </label>

      <Button
        size="sm"
        onClick={handleSave}
        disabled={saving}
        className="h-8 bg-[#0A84FF] text-white hover:bg-[#0070e0]"
      >
        {saving ? (
          <>
            <Loader2 className="mr-1.5 size-3 animate-spin" />
            Saving…
          </>
        ) : (
          "Save credentials"
        )}
      </Button>
    </div>
  );
}

// ── Google Play info panel ────────────────────────────────────────────────────

function GooglePlayInfo({ app }: { app: WorkspaceApp }) {
  const [email, setEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/google-play/service-account");
        if (!res.ok) return;
        const data = (await res.json()) as { email: string | null };
        if (!cancelled) setEmail(data.email);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  async function copyEmail() {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
      <p className="text-xs font-medium text-gray-600">Google Play connection</p>

      <ol className="space-y-2.5 text-xs text-gray-500 leading-relaxed">
        <li>
          <span className="font-semibold text-gray-700">1.</span> Open{" "}
          <a
            href="https://play.google.com/console"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#0A84FF] underline-offset-2 hover:underline"
          >
            Google Play Console
          </a>
          {" "}→ Users &amp; Permissions → Invite new user.
        </li>
        <li>
          <span className="font-semibold text-gray-700">2.</span> Invite this email:
          <div className="mt-1.5 flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5">
            <code className="flex-1 truncate font-mono text-[11px] text-gray-700">
              {email ?? "Loading…"}
            </code>
            <button
              type="button"
              onClick={copyEmail}
              disabled={!email}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-[#0A84FF] hover:bg-[#0A84FF]/10 disabled:opacity-30"
            >
              <Copy className="size-3" />
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </li>
        <li>
          <span className="font-semibold text-gray-700">3.</span> Grant these permissions:
          <ul className="mt-1 ml-3 list-disc space-y-0.5 text-gray-500">
            <li><span className="font-medium text-gray-600">View app information &amp; download bulk reports</span></li>
            <li><span className="font-medium text-gray-600">Reply to reviews</span></li>
          </ul>
        </li>
        <li>
          <span className="font-semibold text-gray-700">4.</span> Scope to your app{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[10px] text-gray-600">{app.store_id}</code>
          {" "}then Send invitation. Click <strong>Sync now</strong> above when done.
        </li>
      </ol>

      <a
        href="/help/connect-google-play"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0A84FF] hover:underline"
      >
        Full walkthrough with screenshots →
      </a>

      <div className="flex items-center gap-1.5 border-t border-gray-200 pt-2.5 text-xs text-emerald-600">
        <CheckCircle2 className="size-3.5" />
        Service account ready
      </div>
      {app.last_synced_at && (
        <p className="text-xs text-gray-400">
          Last synced: {formatReviewDate(app.last_synced_at)}
        </p>
      )}
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

  const isAppStore = app.platform === "app_store";
  const Icon = isAppStore ? Globe : Smartphone;

  const statusLabel = app.has_credentials || app.platform === "google_play"
    ? "Connected"
    : "Needs setup";
  const statusClass = app.has_credentials || app.platform === "google_play"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-amber-50 text-amber-700 border-amber-200";

  async function handleDelete() {
    if (!confirm(`Remove "${app.name}"? This will delete all synced reviews.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/apps/${app.id}`, { method: "DELETE" });
      onDeleted();
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
    <div className="border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
          <Icon className="size-4 text-gray-500" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{app.name}</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
              {app.store_id}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-400">
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
            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
            onClick={handleSync}
            disabled={syncing}
            title="Sync now"
          >
            <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
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
            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
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

      {expanded && (
        <div className="border-t border-gray-50 px-4 pb-4">
          {isAppStore ? (
            <AppStoreForm app={app} onSaved={onUpdated} />
          ) : (
            <GooglePlayInfo app={app} />
          )}
        </div>
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
      <div className="flex items-center justify-center border-t border-dashed border-gray-200 px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-gray-500 hover:text-gray-700"
          onClick={() => setOpen(true)}
        >
          <Plus className="size-3.5" />
          Add app
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-dashed border-gray-200 px-4 py-4">
      <p className="text-xs font-medium text-gray-600">Add new app</p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">App name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My App"
            className="mt-1 h-8 border-gray-200 bg-gray-50 text-sm focus:bg-white"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Platform</span>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as "google_play" | "app_store")}
            className="mt-1 h-8 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/20"
          >
            <option value="google_play">Google Play</option>
            <option value="app_store">App Store</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-gray-600">
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
          className="mt-1 h-8 border-gray-200 bg-gray-50 font-mono text-sm focus:bg-white"
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
          className="h-8 text-xs text-gray-500"
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
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Connected apps</h2>
        <p className="mt-0.5 text-xs text-gray-400">
          Apps synced to this workspace · reviews are fetched daily
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-4 animate-spin text-gray-400" />
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
          <p className="text-sm text-gray-500">No apps connected yet.</p>
          <p className="text-xs text-gray-400">Add your first Google Play or App Store app below.</p>
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
