"use client";

import { useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import {
  Apple, ArrowLeft, Check, ChevronRight, Loader2, Plug, Search, Smartphone, Sparkles,
} from "lucide-react";
import { track } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { APP_CATEGORIES, type AppCategory } from "@/lib/brand-voice-stubs";
import type { BrandVoiceConfig } from "@/app/api/onboarding/setup/route";
import type { OnboardingProgress } from "@/app/api/onboarding/progress/route";

// ── Types ──────────────────────────────────────────────────────────────────────

type Platform = "google-play" | "app-store";

interface SelectedApp {
  storeId:   string;
  name:      string;
  developer: string;
  icon:      string | null;
  rating:    number | null;
  /** Storefront the app was found in — reviews must be scraped from it. */
  country:   string | null;
}

interface FormState {
  workspaceName: string;
  workspaceSlug: string;
  platform:      Platform;
  selectedApp:   SelectedApp | null;
  appCategory:   AppCategory | null;
  brandVoice:    BrandVoiceConfig;
}

function slugify(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const DEFAULT_BRAND_VOICE: BrandVoiceConfig = {
  tone:         "professional",
  wordsToUse:   [],
  wordsToAvoid: [],
  signOff:      "",
  replyLength:  "standard",
};

const STEPS = [
  { label: "Workspace" },
  { label: "Your App"  },
  { label: "Brand Voice" },
  { label: "Connect"   },
  { label: "Ready"     },
];

// ── Slug check state ───────────────────────────────────────────────────────────
type SlugStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "invalid" }
  | { state: "reserved"; suggestions: string[] }
  | { state: "taken";    suggestions: string[] };

// ── Main page ──────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { session } = useClerk();
  const [step, setStep]         = useState(1);
  const [form, setForm]         = useState<FormState>({
    workspaceName: "",
    workspaceSlug: "",
    platform:      "google-play",
    selectedApp:   null,
    appCategory:   null,
    brandVoice:    DEFAULT_BRAND_VOICE,
  });
  const [slugStatus, setSlugStatus]     = useState<SlugStatus>({ state: "idle" });
  const [slugError, setSlugError]       = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);
  const [workspaceId, setWorkspaceId]   = useState<string | null>(null);
  const [hydrating, setHydrating]       = useState(true);
  const slugTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);
  const sessionRef  = useRef(session);
  sessionRef.current = session;

  // ── Hydrate from server on mount ────────────────────────────────────────────
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/state");
        if (!res.ok) return;
        const data = (await res.json()) as {
          onboarded: boolean;
          hasWorkspace: boolean;
          hasApp: boolean;
          workspace: { id: string; name: string; slug: string } | null;
          app: { name: string; platform: string; storeId: string } | null;
        };
        if (cancelled) return;
        if (data.onboarded) {
          try { await sessionRef.current?.reload(); } catch { /* non-fatal */ }
          window.location.href = "/dashboard";
          return;
        }
        setForm((p) => ({
          ...p,
          workspaceName: data.workspace?.name ?? p.workspaceName,
          workspaceSlug: data.workspace?.slug ?? p.workspaceSlug,
          platform: data.app?.platform === "app_store" ? "app-store" : p.platform,
          selectedApp: data.app ? {
            storeId:   data.app.storeId ?? "",
            name:      data.app.name ?? "",
            country:   null,
            developer: "",
            icon:      null,
            rating:    null,
          } : p.selectedApp,
        }));
        if (data.workspace?.id) setWorkspaceId(data.workspace.id);
        if (data.hasWorkspace && data.hasApp) setStep(4);
        else if (data.hasWorkspace) setStep(2);
      } catch { /* fall through */ }
      finally { if (!cancelled) setHydrating(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Slug availability check ──────────────────────────────────────────────────
  useEffect(() => {
    if (slugTimer.current) clearTimeout(slugTimer.current);
    const slug = form.workspaceSlug.trim();
    if (!slug) { setSlugStatus({ state: "idle" }); return; }
    setSlugStatus({ state: "checking" });
    slugTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/onboarding/slug-check?slug=${encodeURIComponent(slug)}`);
        if (!res.ok) { setSlugStatus({ state: "idle" }); return; }
        const d = (await res.json()) as { available: boolean; reason?: string; suggestions: string[] };
        if (d.available)                 setSlugStatus({ state: "available" });
        else if (d.reason === "INVALID") setSlugStatus({ state: "invalid" });
        else if (d.reason === "RESERVED")setSlugStatus({ state: "reserved", suggestions: d.suggestions });
        else                             setSlugStatus({ state: "taken",    suggestions: d.suggestions });
      } catch { setSlugStatus({ state: "idle" }); }
    }, 400);
    return () => { if (slugTimer.current) clearTimeout(slugTimer.current); };
  }, [form.workspaceSlug]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => {
      const n = { ...p, [k]: v };
      if (k === "workspaceName" && typeof v === "string") n.workspaceSlug = slugify(v);
      if (k === "platform") n.selectedApp = null;
      if (k === "workspaceName" || k === "workspaceSlug") setSlugError(null);
      return n;
    });

  const setBv = (patch: Partial<BrandVoiceConfig>) =>
    setForm((p) => ({ ...p, brandVoice: { ...p.brandVoice, ...patch } }));

  // ── Step 3 → calls /api/onboarding/setup → fires bootstrap ──────────────────
  const handleSetup = async () => {
    if (!form.selectedApp) { setSaveError("Please select your app first."); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/onboarding/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: form.workspaceName,
          workspaceSlug: form.workspaceSlug,
          appName:       form.selectedApp.name,
          platform:      form.platform,
          storeId:       form.selectedApp.storeId,
          appCategory:   form.appCategory,
          icon:          form.selectedApp.icon,
          developer:     form.selectedApp.developer,
          rating:        form.selectedApp.rating,
          country:       form.selectedApp.country,
          brandVoice:    form.brandVoice,
        }),
      });
      if (res.status === 409) {
        const d = (await res.json()) as { error?: { code: string } };
        if (d.error?.code === "SLUG_TAKEN") {
          setSlugError("Workspace URL already taken — try a different one.");
          setStep(1);
          return;
        }
      }
      if (!res.ok) { setSaveError("Something went wrong. Please try again."); return; }
      const d = (await res.json()) as { workspaceId: string; appId: string };
      setWorkspaceId(d.workspaceId);
      track({ name: "onboarding_setup", properties: { platform: form.platform } });
      setStep(4);
    } catch { setSaveError("Network error. Please try again."); }
    finally { setSaving(false); }
  };

  // ── Step 5 → calls /api/onboarding/complete → marks onboarded ────────────────
  const handleComplete = async () => {
    if (!form.selectedApp) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: form.workspaceName,
          workspaceSlug: form.workspaceSlug,
          appName:       form.selectedApp.name,
          platform:      form.platform,
          storeId:       form.selectedApp.storeId,
          appCategory:   form.appCategory,
          icon:          form.selectedApp.icon,
          developer:     form.selectedApp.developer,
          rating:        form.selectedApp.rating,
          country:       form.selectedApp.country,
        }),
      });
      if (!res.ok && res.status !== 409) {
        setSaveError("Something went wrong. Please try again.");
        return;
      }
      track({ name: "onboarding_completed", properties: { platform: form.platform } });
      try { await sessionRef.current?.reload(); } catch { /* non-fatal */ }
      window.location.href = "/dashboard";
    } catch { setSaveError("Network error. Please try again."); }
    finally { setSaving(false); }
  };

  if (hydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 className="size-5 animate-spin text-fg-3" strokeWidth={1.5} />
      </div>
    );
  }

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
      {/* Logo */}
      <div className="mb-10 flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-[#0A84FF]">
          <span className="text-sm font-bold text-white">R</span>
        </div>
        <span className="text-lg font-semibold tracking-tight text-fg-1">ReviewBox</span>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-[var(--rb-border-1)] bg-surface p-8">
        {/* Step indicator */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const active = n === step;
              const done   = n < step;
              return (
                <div key={s.label} className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
                    done   && "bg-[#0A84FF] text-white",
                    active && "bg-[#0A84FF] text-white ring-2 ring-[#0A84FF]/30",
                    !done && !active && "bg-[var(--rb-bg-sunken)] text-fg-3",
                  )}>
                    {done ? "✓" : n}
                  </div>
                  <span className={cn("text-[9px] font-medium hidden sm:block",
                    active ? "text-fg-2" : "text-fg-3",
                  )}>{s.label}</span>
                </div>
              );
            })}
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-[var(--rb-bg-hover)]">
            <div
              className="h-full rounded-full bg-[#0A84FF] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* ── Step 1: Workspace ── */}
        {step === 1 && (
          <Step1Workspace
            form={form}
            set={set}
            slugStatus={slugStatus}
            slugError={slugError}
            onNext={() => {
              if (!form.workspaceName.trim()) return;
              if (slugStatus.state === "invalid" || slugStatus.state === "taken") return;
              setStep(2);
            }}
          />
        )}

        {/* ── Step 2: Find app ── */}
        {step === 2 && (
          <Step2App
            form={form}
            set={set}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {/* ── Step 3: Brand voice ── */}
        {step === 3 && (
          <Step3BrandVoice
            bv={form.brandVoice}
            setBv={setBv}
            saving={saving}
            saveError={saveError}
            onBack={() => setStep(2)}
            onNext={handleSetup}
          />
        )}

        {/* ── Step 4: Connect store ── */}
        {step === 4 && (
          <Step4Connect
            platform={form.platform}
            appName={form.selectedApp?.name ?? ""}
            onSkip={() => setStep(5)}
            onDone={() => setStep(5)}
          />
        )}

        {/* ── Step 5: Ready ── */}
        {step === 5 && (
          <Step5Ready
            workspaceId={workspaceId}
            appName={form.selectedApp?.name ?? ""}
            saving={saving}
            saveError={saveError}
            onLaunch={handleComplete}
          />
        )}
      </div>
    </div>
  );
}

// ── Step 1: Workspace ──────────────────────────────────────────────────────────

function Step1Workspace({
  form, set, slugStatus, slugError, onNext,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  slugStatus: SlugStatus;
  slugError: string | null;
  onNext: () => void;
}) {
  const canContinue =
    form.workspaceName.trim().length >= 2 &&
    form.workspaceSlug.trim().length >= 3 &&
    slugStatus.state !== "invalid" &&
    slugStatus.state !== "taken";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg-1">Name your workspace</h2>
        <p className="mt-1 text-sm text-fg-3">Usually your company or app name.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-fg-3">Workspace name</label>
          <Input
            value={form.workspaceName}
            onChange={(e) => set("workspaceName", e.target.value)}
            placeholder="Acme Corp"
            className="border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] text-fg-1 placeholder:text-fg-3 focus-visible:ring-[#0A84FF]"
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-fg-3">Workspace URL</label>
          <div className="flex items-center gap-2 rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-3 py-2">
            <span className="shrink-0 text-xs text-fg-3">tryreviewbox.com/</span>
            <input
              value={form.workspaceSlug}
              onChange={(e) => set("workspaceSlug", slugify(e.target.value))}
              placeholder="acme"
              className="min-w-0 flex-1 bg-transparent text-sm text-fg-1 outline-none placeholder:text-fg-3"
            />
            {slugStatus.state === "checking" && <Loader2 className="size-3 animate-spin text-fg-3" strokeWidth={1.5} />}
            {slugStatus.state === "available" && <Check className="size-3 text-[#1F8A5B]" strokeWidth={2} />}
          </div>
          {(slugStatus.state === "taken" || slugStatus.state === "reserved" || slugStatus.state === "invalid" || slugError) && (
            <p className="mt-1 text-xs text-red-400">
              {slugError ?? (slugStatus.state === "taken" ? "Already taken." : slugStatus.state === "reserved" ? "Reserved URL." : "Invalid — use letters, numbers, hyphens.")}
            </p>
          )}
          {(slugStatus.state === "taken" || slugStatus.state === "reserved") && (slugStatus as { suggestions: string[] }).suggestions?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {(slugStatus as { suggestions: string[] }).suggestions.slice(0, 3).map((s) => (
                <button
                  key={s}
                  onClick={() => set("workspaceSlug", s)}
                  className="rounded border border-[var(--rb-border-1)] px-2 py-0.5 text-[10px] text-fg-3 hover:text-fg-1"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!canContinue}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A84FF] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#006EE0] disabled:cursor-not-allowed disabled:bg-[var(--rb-bg-hover)] disabled:text-fg-3"
      >
        Continue <ChevronRight className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}

// ── Step 2: Find app ───────────────────────────────────────────────────────────

interface SearchResult {
  storeId:   string;
  name:      string;
  developer: string;
  icon:      string | null;
  rating:    number | null;
  country:   string | null;
}

function Step2App({
  form, set, onBack, onNext,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState<SearchResult[]>([]);
  const [searching, setSearching]   = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 2) { setResults([]); setSearchFailed(false); return; }
    setSearching(true);
    // The debounce only cancels the pending timer — a request already in flight
    // still resolved and overwrote the results. Typing "face" then "facebook"
    // could leave the slower "face" response on screen under the newer query,
    // and this is the step where the user picks which app to connect.
    let stale = false;
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/onboarding/search-app?query=${encodeURIComponent(query.trim())}&platform=${form.platform}`
        );
        if (stale) return;
        if (!res.ok) { setSearchFailed(true); setSearching(false); return; }
        const d = (await res.json()) as { results: SearchResult[]; searchFailed?: boolean };
        if (stale) return;
        setResults(d.results ?? []);
        setSearchFailed(!!d.searchFailed);
      } catch { if (!stale) setSearchFailed(true); }
      finally { if (!stale) setSearching(false); }
    }, 400);
    return () => {
      stale = true;
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, form.platform]);

  const selectApp = (r: SearchResult) => {
    set("selectedApp", {
      storeId:   r.storeId,
      name:      r.name,
      developer: r.developer,
      country:   r.country ?? null,
      icon:      r.icon,
      rating:    r.rating,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <button onClick={onBack} className="mb-3 flex items-center gap-1 text-xs text-fg-3 hover:text-fg-2">
          <ArrowLeft className="size-3" strokeWidth={2} /> Back
        </button>
        <h2 className="text-xl font-semibold text-fg-1">Find your app</h2>
        <p className="mt-1 text-sm text-fg-3">Search by name or paste the bundle/package ID.</p>
      </div>

      {/* Platform selector */}
      <div className="grid grid-cols-2 gap-2">
        {(["google-play", "app-store"] as Platform[]).map((p) => (
          <button
            key={p}
            onClick={() => set("platform", p)}
            className={cn(
              "rounded-xl border px-4 py-3 text-xs font-semibold transition-colors",
              form.platform === p
                ? "border-[#0A84FF] bg-[#0A84FF]/10 text-[#0A84FF]"
                : "border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] text-fg-3 hover:border-[var(--rb-border-3)] hover:text-fg-2",
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              {p === "google-play"
                ? <Smartphone className="size-3.5" strokeWidth={1.5} />
                : <Apple className="size-3.5" strokeWidth={1.5} />}
              {p === "google-play" ? "Google Play" : "App Store"}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3" strokeWidth={1.5} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your app…"
          className="w-full rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] py-2.5 pl-9 pr-4 text-sm text-fg-1 placeholder:text-fg-3 outline-none focus:border-[#0A84FF]/50"
          autoFocus
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-fg-3" strokeWidth={1.5} />}
      </div>

      {/* Selected app pill */}
      {form.selectedApp && (
        <div className="flex items-center gap-3 rounded-xl border border-[#0A84FF]/30 bg-[#0A84FF]/10 p-3">
          {form.selectedApp.icon
            ? <img src={form.selectedApp.icon} alt="" className="size-8 shrink-0 rounded-lg" />
            : <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--rb-bg-hover)] text-xs font-bold text-fg-2">{form.selectedApp.name[0]}</div>
          }
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-fg-1">{form.selectedApp.name}</div>
            <div className="text-xs text-fg-3">{form.selectedApp.developer} {form.selectedApp.rating ? `· ${form.selectedApp.rating.toFixed(1)}★` : ""}</div>
          </div>
          <Check className="size-4 shrink-0 text-[#0A84FF]" strokeWidth={2} />
        </div>
      )}

      {/* Results */}
      {results.length > 0 && !form.selectedApp && (
        <div className="max-h-[200px] overflow-y-auto rounded-xl border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)]">
          {results.map((r, i) => (
            <button
              key={r.storeId}
              onClick={() => { selectApp(r); setQuery(""); setResults([]); }}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--rb-bg-hover)]",
                i < results.length - 1 && "border-b border-[var(--rb-border-1)]",
              )}
            >
              {r.icon
                ? <img src={r.icon} alt="" className="size-8 shrink-0 rounded-lg" />
                : <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--rb-bg-hover)] text-xs font-bold text-fg-2">{r.name[0]}</div>
              }
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-fg-1">{r.name}</div>
                <div className="text-xs text-fg-3">{r.developer} {r.rating ? `· ${r.rating.toFixed(1)}★` : ""}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {searchFailed && (
        <p className="text-xs text-amber-400">Search unavailable — enter your package/bundle ID manually.</p>
      )}

      {/* App category */}
      {form.selectedApp && (
        <div>
          <p className="mb-2 text-xs font-medium text-fg-3">App category (helps tailor AI replies)</p>
          <div className="flex flex-wrap gap-1.5">
            {APP_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => set("appCategory", c.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                  form.appCategory === c.id
                    ? "border-[#0A84FF] bg-[#0A84FF]/10 text-[#0A84FF]"
                    : "border-[var(--rb-border-1)] text-fg-3 hover:border-[var(--rb-border-3)] hover:text-fg-2",
                )}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!form.selectedApp}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A84FF] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#006EE0] disabled:cursor-not-allowed disabled:bg-[var(--rb-bg-hover)] disabled:text-fg-3"
      >
        Continue <ChevronRight className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}

// ── Step 3: Brand voice ────────────────────────────────────────────────────────

const TONES: { id: BrandVoiceConfig["tone"]; label: string; desc: string }[] = [
  { id: "professional", label: "Professional", desc: "Polished, formal, trust-building" },
  { id: "friendly",     label: "Friendly",     desc: "Warm, approachable, personable" },
  { id: "empathetic",   label: "Empathetic",   desc: "Caring, understanding, patient" },
  { id: "direct",       label: "Direct",       desc: "Concise, clear, no fluff" },
];
const LENGTHS: { id: BrandVoiceConfig["replyLength"]; label: string; desc: string }[] = [
  { id: "short",    label: "Short",    desc: "1–2 sentences" },
  { id: "standard", label: "Standard", desc: "2–3 sentences" },
  { id: "detailed", label: "Detailed", desc: "3–5 sentences" },
];

function Step3BrandVoice({
  bv, setBv, saving, saveError, onBack, onNext,
}: {
  bv:       BrandVoiceConfig;
  setBv:    (p: Partial<BrandVoiceConfig>) => void;
  saving:   boolean;
  saveError: string | null;
  onBack:   () => void;
  onNext:   () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <button onClick={onBack} className="mb-3 flex items-center gap-1 text-xs text-fg-3 hover:text-fg-2">
          <ArrowLeft className="size-3" strokeWidth={2} /> Back
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-[#0A84FF]" strokeWidth={1.5} />
          <h2 className="text-xl font-semibold text-fg-1">Your brand voice</h2>
        </div>
        <p className="mt-1 text-sm text-fg-3">AI uses this to write replies that sound like you.</p>
      </div>

      {/* Tone */}
      <div>
        <p className="mb-2 text-xs font-medium text-fg-3">Reply tone</p>
        <div className="grid grid-cols-2 gap-2">
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => setBv({ tone: t.id })}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                bv.tone === t.id
                  ? "border-[#0A84FF] bg-[#0A84FF]/10"
                  : "border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] hover:border-[var(--rb-border-3)]",
              )}
            >
              <div className={cn("text-sm font-semibold", bv.tone === t.id ? "text-[#0A84FF]" : "text-fg-2")}>
                {t.label}
              </div>
              <div className="mt-0.5 text-[10px] text-fg-3">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Words to use */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-fg-3">
          Words we love to use <span className="text-fg-3">(optional)</span>
        </label>
        <input
          value={bv.wordsToUse.join(", ")}
          onChange={(e) => setBv({ wordsToUse: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          placeholder="thank you, we appreciate, our team…"
          className="w-full rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-3 py-2.5 text-sm text-fg-1 placeholder:text-fg-3 outline-none focus:border-[#0A84FF]/50"
        />
      </div>

      {/* Words to avoid */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-fg-3">
          Words we never use <span className="text-fg-3">(optional)</span>
        </label>
        <input
          value={bv.wordsToAvoid.join(", ")}
          onChange={(e) => setBv({ wordsToAvoid: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          placeholder="unfortunately, can't, won't…"
          className="w-full rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-3 py-2.5 text-sm text-fg-1 placeholder:text-fg-3 outline-none focus:border-[#0A84FF]/50"
        />
      </div>

      {/* Sign-off */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-fg-3">
          Sign off as <span className="text-fg-3">(optional)</span>
        </label>
        <input
          value={bv.signOff}
          onChange={(e) => setBv({ signOff: e.target.value })}
          placeholder="The Acme Team"
          className="w-full rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-3 py-2.5 text-sm text-fg-1 placeholder:text-fg-3 outline-none focus:border-[#0A84FF]/50"
        />
      </div>

      {/* Reply length */}
      <div>
        <p className="mb-2 text-xs font-medium text-fg-3">Reply length</p>
        <div className="grid grid-cols-3 gap-2">
          {LENGTHS.map((l) => (
            <button
              key={l.id}
              onClick={() => setBv({ replyLength: l.id })}
              className={cn(
                "rounded-xl border p-2.5 text-left transition-colors",
                bv.replyLength === l.id
                  ? "border-[#0A84FF] bg-[#0A84FF]/10"
                  : "border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] hover:border-[var(--rb-border-3)]",
              )}
            >
              <div className={cn("text-xs font-semibold", bv.replyLength === l.id ? "text-[#0A84FF]" : "text-fg-2")}>
                {l.label}
              </div>
              <div className="mt-0.5 text-[9px] text-fg-3">{l.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {saveError && <p className="text-xs text-red-400">{saveError}</p>}

      <button
        onClick={onNext}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A84FF] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#006EE0] disabled:cursor-not-allowed disabled:bg-[var(--rb-bg-hover)] disabled:text-fg-3"
      >
        {saving ? <><Loader2 className="size-4 animate-spin" strokeWidth={2} /> Setting up…</> : <>Set up my workspace <ChevronRight className="size-4" strokeWidth={2} /></>}
      </button>
      <p className="text-center text-[11px] text-fg-3">
        You can edit this later in Settings → Brand Voice
      </p>
    </div>
  );
}

// ── Step 4: Connect store ──────────────────────────────────────────────────────

function Step4Connect({
  platform, appName, onSkip, onDone,
}: {
  platform: Platform;
  appName:  string;
  onSkip:   () => void;
  onDone:   () => void;
}) {
  const isGP = platform === "google-play";

  // The address to invite is read from the server, never guessed. This used to
  // render `NEXT_PUBLIC_GOOGLE_CLIENT_EMAIL ?? "reviews@reviewbox.iam.gserviceaccount.com"`
  // — a variable that is set nowhere, so every customer was told to invite a
  // made-up address. They'd invite it, wait the instructed ten minutes, click
  // "I've done this", and the connection would silently never work.
  const [serviceAccount, setServiceAccount] = useState<string | null>(null);
  const [serviceAccountState, setServiceAccountState] =
    useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    if (!isGP) return;
    let cancelled = false;
    fetch("/api/google-play/service-account")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { email?: string | null } | null) => {
        if (cancelled) return;
        if (data?.email) {
          setServiceAccount(data.email);
          setServiceAccountState("ready");
        } else {
          setServiceAccountState("missing");
        }
      })
      .catch(() => { if (!cancelled) setServiceAccountState("missing"); });
    return () => { cancelled = true; };
  }, [isGP]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Plug className="size-4 text-[#0A84FF]" strokeWidth={1.5} />
          <h2 className="text-xl font-semibold text-fg-1">
            Connect {isGP ? "Google Play" : "App Store"}
          </h2>
        </div>
        <p className="mt-1 text-sm text-fg-3">
          Unlock ongoing sync, rating changes, and reply publishing.
          <span className="ml-1 text-fg-3">Optional — you already have 14 days of reviews.</span>
        </p>
      </div>

      {isGP ? (
        <div className="rounded-xl border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-4 space-y-3">
          <p className="text-xs font-semibold text-fg-2 uppercase tracking-widest">Google Play setup</p>
          <ol className="space-y-2 text-sm text-fg-2">
            <li className="flex gap-2"><span className="shrink-0 font-mono text-[#0A84FF]">1.</span>Open <span className="font-medium text-fg-2">Google Play Console</span> → Users & Permissions</li>
            <li className="flex gap-2">
              <span className="shrink-0 font-mono text-[#0A84FF]">2.</span>
              {serviceAccountState === "ready" ? (
                <span>
                  Invite{" "}
                  <span className="font-mono text-xs text-[#0A84FF] bg-[#0A84FF]/10 px-1 rounded break-all">
                    {serviceAccount}
                  </span>
                </span>
              ) : serviceAccountState === "loading" ? (
                <span className="text-fg-3">Loading the address to invite…</span>
              ) : (
                <span>
                  Invite our service account — the address isn&apos;t available right now.
                  You can finish this later from{" "}
                  <span className="font-medium text-fg-2">Settings → Integrations</span>,
                  which always shows the current one.
                </span>
              )}
            </li>
            <li className="flex gap-2"><span className="shrink-0 font-mono text-[#0A84FF]">3.</span>Set role to <span className="font-medium text-fg-2">Release Manager</span> with View+Reply permissions</li>
            <li className="flex gap-2"><span className="shrink-0 font-mono text-[#0A84FF]">4.</span>Wait ~10 minutes for permissions to propagate, then click Done</li>
          </ol>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-4 space-y-3">
          <p className="text-xs font-semibold text-fg-2 uppercase tracking-widest">App Store Connect setup</p>
          <p className="text-sm text-fg-2">Generate an API key in App Store Connect and paste it in <span className="font-medium text-fg-2">Settings → Integrations</span> after launching.</p>
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={onDone}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A84FF] py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          I&apos;ve done this — continue <ChevronRight className="size-4" strokeWidth={2} />
        </button>
        <button
          onClick={onSkip}
          className="w-full py-2 text-sm text-fg-2 hover:text-fg-1"
        >
          I&apos;ll connect later
        </button>
      </div>
    </div>
  );
}

// ── Step 5: Ready ──────────────────────────────────────────────────────────────

function Step5Ready({
  workspaceId, appName, saving, saveError, onLaunch,
}: {
  workspaceId: string | null;
  appName:     string;
  saving:      boolean;
  saveError:   string | null;
  onLaunch:    () => void;
}) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [elapsed, setElapsed]   = useState(0);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    clockRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, []);

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/onboarding/progress");
        if (!res.ok) return;
        const d = (await res.json()) as OnboardingProgress;
        setProgress(d);
      } catch { /* non-fatal */ }
    }, 3000);
    // Immediate first poll
    void fetch("/api/onboarding/progress")
      .then((r) => r.json() as Promise<OnboardingProgress>)
      .then(setProgress)
      .catch(() => null);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Allow launching after 10s minimum OR when sync is done
  const canLaunch = elapsed >= 10 || progress?.syncDone || (progress?.reviewCount ?? 0) > 0;

  const checks = [
    { label: "App connected",         done: true },
    { label: "Brand voice saved",     done: true },
    { label: `Reviews loading${progress?.reviewCount ? ` (${progress.reviewCount})` : "…"}`, done: (progress?.reviewCount ?? 0) > 0 },
    { label: "AI templates ready",    done: (progress?.templateCount ?? 0) > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-[#0A84FF]/10">
          <Sparkles className="size-6 text-[#0A84FF]" strokeWidth={1.5} />
        </div>
        <h2 className="text-xl font-semibold text-fg-1">
          {canLaunch ? "Your workspace is ready" : "Preparing your workspace…"}
        </h2>
        <p className="mt-1 text-sm text-fg-3">
          {canLaunch
            ? `${appName} is set up with${progress?.reviewCount ? ` ${progress.reviewCount} reviews,` : ""} AI drafts${progress?.templateCount ? ` and ${progress.templateCount} templates` : ""}.`
            : "Fetching your reviews and generating AI content. Takes about 15-20 seconds."}
        </p>
      </div>

      {/* Stats row */}
      {progress && (progress.rating !== null || progress.reviewTotal !== null || progress.reviewCount > 0) && (
        <div className="grid grid-cols-3 gap-3">
          {progress.rating !== null && (
            <div className="rounded-xl border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-3 text-center">
              <div className="text-2xl font-semibold text-fg-1">{progress.rating.toFixed(1)}</div>
              <div className="text-[10px] text-fg-3">Store rating</div>
            </div>
          )}
          {progress.reviewTotal !== null && (
            <div className="rounded-xl border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-3 text-center">
              <div className="text-2xl font-semibold text-fg-1">{progress.reviewTotal.toLocaleString()}</div>
              <div className="text-[10px] text-fg-3">Total reviews</div>
            </div>
          )}
          {progress.reviewCount > 0 && (
            <div className="rounded-xl border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-3 text-center">
              <div className="text-2xl font-semibold text-fg-1">{progress.reviewCount}</div>
              <div className="text-[10px] text-fg-3">In inbox</div>
            </div>
          )}
        </div>
      )}

      {/* Progress checklist */}
      <div className="space-y-2.5">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-3">
            <div className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full",
              c.done ? "bg-[#0A84FF]" : "bg-[var(--rb-bg-hover)]",
            )}>
              {c.done
                ? <Check className="size-3 text-white" strokeWidth={2.5} />
                : <Loader2 className="size-3 animate-spin text-fg-3" strokeWidth={1.5} />
              }
            </div>
            <span className={cn("text-sm", c.done ? "text-fg-2" : "text-fg-3")}>
              {c.label}
            </span>
          </div>
        ))}
      </div>

      {saveError && <p className="text-xs text-red-400">{saveError}</p>}

      <button
        onClick={onLaunch}
        disabled={!canLaunch || saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0A84FF] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#006EE0] disabled:cursor-not-allowed disabled:bg-[var(--rb-bg-hover)] disabled:text-fg-3"
      >
        {saving
          ? <><Loader2 className="size-4 animate-spin" strokeWidth={2} /> Launching…</>
          : canLaunch
            ? <>Launch my workspace <ChevronRight className="size-4" strokeWidth={2} /></>
            : <><Loader2 className="size-4 animate-spin" strokeWidth={1.5} /> Preparing… ({elapsed}s)</>
        }
      </button>
    </div>
  );
}
