"use client";

import { useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";

import {
  Check, ChevronRight, Plug, X, Loader2, Zap, MessageSquare, Bell,
  Search, ArrowLeft,
} from "lucide-react";
import { track } from "@/lib/analytics";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { APP_CATEGORIES, type AppCategory } from "@/lib/brand-voice-stubs";

type Platform = "google-play" | "app-store";

interface SelectedApp {
  storeId: string;
  name: string;
  developer: string;
  icon: string | null;
}

interface FormState {
  workspaceName: string;
  workspaceSlug: string;
  platform: Platform;
  /** Selected app from search OR manual entry. null = nothing picked yet. */
  selectedApp: SelectedApp | null;
  appCategory: AppCategory | null;
}

interface OnboardingResult {
  workspaceId: string;
  appId: string;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const STEPS = [
  { label: "Workspace" },
  { label: "Your App" },
  { label: "Connect" },
  { label: "Done" },
];

type SlugStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "invalid" }
  | { state: "reserved"; suggestions: string[] }
  | { state: "taken"; suggestions: string[] };

export default function OnboardingPage() {
  const { session } = useClerk();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    workspaceName: "",
    workspaceSlug: "",
    platform: "google-play",
    selectedApp: null,
    appCategory: null,
  });
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ state: "idle" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);
  // Capture session in a ref so the hydration effect doesn't re-fire every
  // render when Clerk's session object reference changes. Effect runs once.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Resume: hydrate from server state on mount — RUN EXACTLY ONCE
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
          workspace: { name: string; slug: string } | null;
          app: { name: string; platform: string; storeId: string } | null;
        };
        if (cancelled) return;

        if (data.onboarded) {
          try { await sessionRef.current?.reload(); } catch { /* non-fatal */ }
          window.location.href = "/dashboard";
          return;
        }

        setForm((prev) => ({
          ...prev,
          workspaceName: data.workspace?.name ?? prev.workspaceName,
          workspaceSlug: data.workspace?.slug ?? prev.workspaceSlug,
          platform: data.app?.platform === "app_store" ? "app-store" : prev.platform,
          selectedApp: data.app
            ? {
                storeId: data.app.storeId ?? "",
                name: data.app.name ?? "",
                developer: "",
                icon: null,
              }
            : prev.selectedApp,
        }));

        if (data.hasWorkspace && data.hasApp) setStep(3);
        else if (data.hasWorkspace) setStep(2);
      } catch {
        /* fall through to step 1 */
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => { cancelled = true; };
    // Intentionally empty — hydration runs once. sessionRef stays current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced slug availability check
  useEffect(() => {
    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
    const slug = form.workspaceSlug.trim();
    if (!slug) {
      setSlugStatus({ state: "idle" });
      return;
    }
    setSlugStatus({ state: "checking" });

    const fallback = setTimeout(() => setSlugStatus({ state: "idle" }), 4000);

    slugCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/onboarding/slug-check?slug=${encodeURIComponent(slug)}`);
        clearTimeout(fallback);
        if (!res.ok) { setSlugStatus({ state: "idle" }); return; }
        const data = (await res.json()) as {
          available: boolean;
          reason?: "INVALID" | "RESERVED" | "TAKEN";
          suggestions: string[];
        };
        if (data.available)            setSlugStatus({ state: "available" });
        else if (data.reason === "INVALID")  setSlugStatus({ state: "invalid" });
        else if (data.reason === "RESERVED") setSlugStatus({ state: "reserved", suggestions: data.suggestions });
        else                                 setSlugStatus({ state: "taken",    suggestions: data.suggestions });
      } catch {
        clearTimeout(fallback);
        setSlugStatus({ state: "idle" });
      }
    }, 400);
    return () => {
      if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
      clearTimeout(fallback);
    };
  }, [form.workspaceSlug]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (key === "workspaceName" || key === "workspaceSlug") setSlugError(null);
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "workspaceName" && typeof value === "string") {
        next.workspaceSlug = slugify(value);
      }
      // Changing platform invalidates the selected app
      if (key === "platform") {
        next.selectedApp = null;
      }
      return next;
    });
  };

  const next = () => setStep((s) => Math.min(s + 1, 4));

  const saveAndAdvance = async () => {
    if (!form.selectedApp) {
      setSaveError("Please pick your app first.");
      setStep(2);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSlugError(null);

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
          // App metadata captured at search time. Server refetches from the
          // store but these are the immediate-display values.
          icon:          form.selectedApp.icon,
          developer:     form.selectedApp.developer,
        }),
      });

      if (res.status === 409) {
        setSlugError("Workspace URL already taken — try a different one.");
        setStep(1);
        return;
      }

      if (!res.ok) {
        setSaveError("Something went wrong. Please try again.");
        return;
      }

      await (res.json() as Promise<OnboardingResult>);
      track({ name: "onboarding_completed", properties: { platform: form.platform } });
      next();
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0d0f14] px-4 py-12">
      <div className="mb-10 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A84FF]">
          <span className="text-sm font-bold text-white">R</span>
        </div>
        <span className="text-lg font-semibold tracking-tight text-white">ReviewBox</span>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#1a1d27] p-8">
        {/* Step indicator + progress bar */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const active = n === step;
              const done = n < step;
              return (
                <div key={s.label} className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    done && "bg-[#0A84FF] text-white",
                    active && "bg-[#0A84FF] text-white ring-2 ring-[#0A84FF]/30",
                    !done && !active && "bg-white/[0.06] text-white/30",
                  )}>
                    {done ? "✓" : n}
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium",
                    active ? "text-white/70" : "text-white/25",
                  )}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[#0A84FF] transition-all duration-500"
              style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        {hydrating && (
          <div className="flex items-center justify-center py-20 text-white/40">
            <Loader2 className="size-5 animate-spin" strokeWidth={1.5} />
          </div>
        )}
        {!hydrating && step === 1 && (
          <StepWorkspace
            form={form}
            update={updateField}
            onNext={next}
            slugError={slugError}
            slugStatus={slugStatus}
          />
        )}
        {!hydrating && step === 2 && (
          <StepApp form={form} update={updateField} onBack={() => setStep(1)} onNext={next} />
        )}
        {!hydrating && step === 3 && (
          <StepConnect
            form={form}
            onBack={() => setStep(2)}
            onNext={saveAndAdvance}
            saving={saving}
            error={saveError}
          />
        )}
        {!hydrating && step === 4 && (
          <StepDone onFinish={async () => {
            try { await session?.reload(); } catch { /* non-fatal */ }
            window.location.href = "/dashboard";
          }} />
        )}
      </div>

      <p className="mt-6 text-xs text-white/20">Step {step} of {STEPS.length}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — Workspace                                                   */
/* ------------------------------------------------------------------ */

function StepWorkspace({
  form,
  update,
  onNext,
  slugError,
  slugStatus,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onNext: () => void;
  slugError: string | null;
  slugStatus: SlugStatus;
}) {
  const slugBorder =
    slugError || slugStatus.state === "taken" || slugStatus.state === "reserved" || slugStatus.state === "invalid"
      ? "border-red-500/60"
      : slugStatus.state === "available"
        ? "border-emerald-500/60"
        : "border-white/[0.08]";

  const canContinue =
    form.workspaceName.trim().length > 0 &&
    slugStatus.state !== "taken" &&
    slugStatus.state !== "reserved" &&
    slugStatus.state !== "invalid";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Tell us about your workspace</h2>
        <p className="mt-1 text-sm text-white/40">
          Your workspace is where your team collaborates on reviews.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">
            Workspace name
          </Label>
          <Input
            value={form.workspaceName}
            onChange={(e) => update("workspaceName", e.target.value)}
            placeholder="Acme Inc."
            className="border-white/[0.08] bg-[#0d0f14] text-white placeholder:text-white/20 focus-visible:ring-[#0A84FF]/50 focus-visible:border-[#0A84FF]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">
            Workspace URL
          </Label>
          <div className={cn("flex items-center overflow-hidden rounded-lg border bg-[#0d0f14] focus-within:border-[#0A84FF]", slugBorder)}>
            <span className="select-none border-r border-white/[0.08] px-3 py-2 text-sm text-white/30">
              tryreviewbox.com/
            </span>
            <input
              value={form.workspaceSlug}
              onChange={(e) => update("workspaceSlug", slugify(e.target.value))}
              placeholder="acme-inc"
              className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/20"
            />
            <span className="pr-3">
              {slugStatus.state === "checking" && <Loader2 className="size-4 animate-spin text-white/30" strokeWidth={1.5} />}
              {slugStatus.state === "available" && <Check className="size-4 text-emerald-400" strokeWidth={2} />}
              {(slugStatus.state === "taken" || slugStatus.state === "reserved" || slugStatus.state === "invalid") && (
                <X className="size-4 text-red-400" strokeWidth={2} />
              )}
            </span>
          </div>

          {slugStatus.state === "invalid" && (
            <p className="text-xs text-red-400">Use 3-40 lowercase letters, numbers, or hyphens.</p>
          )}
          {slugStatus.state === "reserved" && (
            <SlugSuggestions label="That URL is reserved." suggestions={slugStatus.suggestions} onPick={(s) => update("workspaceSlug", s)} />
          )}
          {slugStatus.state === "taken" && (
            <SlugSuggestions label="That URL is taken." suggestions={slugStatus.suggestions} onPick={(s) => update("workspaceSlug", s)} />
          )}
          {slugError && slugStatus.state !== "taken" && (
            <p className="text-xs text-red-400">{slugError}</p>
          )}
        </div>
      </div>

      <Button
        onClick={onNext}
        disabled={!canContinue}
        className="w-full bg-[#0A84FF] text-white hover:bg-[#006EE0] disabled:opacity-40"
      >
        Continue
        <ChevronRight className="ml-1 size-4" strokeWidth={1.5} />
      </Button>
    </div>
  );
}

function SlugSuggestions({
  label,
  suggestions,
  onPick,
}: {
  label: string;
  suggestions: string[];
  onPick: (slug: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-red-400">{label}</span>
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-white/70 transition-colors hover:border-[#0A84FF] hover:text-[#0A84FF]"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — App (search + select)                                       */
/* ------------------------------------------------------------------ */

interface SearchResult extends SelectedApp {
  rating: number | null;
  url: string;
}

type SearchState =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "ok"; results: SearchResult[] }
  | { kind: "no-results" }
  | { kind: "error" };

function StepApp({
  form,
  update,
  onBack,
  onNext,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualId, setManualId] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search whenever query or platform changes
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 2) {
      setState({ kind: "idle" });
      return;
    }
    setState({ kind: "searching" });
    searchTimer.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ platform: form.platform, query: query.trim() });
        const res = await fetch(`/api/onboarding/search-app?${params}`);
        if (!res.ok) { setState({ kind: "error" }); return; }
        const data = (await res.json()) as {
          results: SearchResult[];
          searchFailed?: boolean;
        };
        if (data.searchFailed)         setState({ kind: "error" });
        else if (data.results.length)  setState({ kind: "ok", results: data.results });
        else                           setState({ kind: "no-results" });
      } catch {
        setState({ kind: "error" });
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, form.platform]);

  function pickResult(r: SearchResult) {
    update("selectedApp", {
      storeId: r.storeId,
      name: r.name,
      developer: r.developer,
      icon: r.icon,
    });
  }

  function clearSelection() {
    update("selectedApp", null);
    setShowManual(false);
    setManualName("");
    setManualId("");
  }

  function applyManual() {
    if (!manualName.trim() || !manualId.trim()) return;
    update("selectedApp", {
      storeId: manualId.trim(),
      name: manualName.trim(),
      developer: "",
      icon: null,
    });
  }

  const canContinue = !!form.selectedApp;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Find your app</h2>
        <p className="mt-1 text-sm text-white/40">
          Pick your app from the store. You can add more later in Settings.
        </p>
      </div>

      {/* Platform picker */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">Platform</Label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: "google-play", label: "Google Play" },
            { value: "app-store",   label: "App Store"   },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { update("platform", opt.value); setQuery(""); setState({ kind: "idle" }); }}
              className={cn(
                "rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                form.platform === opt.value
                  ? "border-[#0A84FF] bg-[#0A84FF]/10 text-[#0A84FF]"
                  : "border-white/[0.08] bg-[#0d0f14] text-white/50 hover:border-white/20 hover:text-white/80",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected app pill (if chosen) */}
      {form.selectedApp ? (
        <div className="flex items-center gap-3 rounded-xl border border-[#0A84FF]/40 bg-[#0A84FF]/10 p-3">
          {form.selectedApp.icon ? (
            <img
              src={form.selectedApp.icon}
              alt=""
              className="size-10 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-sm font-bold text-white/40">
              {form.selectedApp.name[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{form.selectedApp.name}</p>
            <p className="truncate text-[11px] text-white/40 font-mono">{form.selectedApp.storeId}</p>
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-white/40 hover:bg-white/[0.06] hover:text-white"
            aria-label="Change app"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          {/* Search box */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">
              Search by app name
            </Label>
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#0d0f14] px-3 focus-within:border-[#0A84FF]">
              <Search size={14} className="shrink-0 text-white/30" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={form.platform === "google-play" ? "Spotify, Notion, Headspace…" : "Spotify, Notion, Headspace…"}
                className="flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/20"
                autoFocus
              />
              {state.kind === "searching" && <Loader2 size={14} className="shrink-0 animate-spin text-white/30" />}
            </div>
          </div>

          {/* Results / states */}
          {state.kind === "ok" && (
            <ul className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto -mt-2">
              {state.results.map((r) => (
                <li key={r.storeId}>
                  <button
                    type="button"
                    onClick={() => pickResult(r)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0d0f14] p-2.5 text-left transition-colors hover:border-[#0A84FF]/40 hover:bg-[#0A84FF]/5"
                  >
                    {r.icon ? (
                      <img src={r.icon} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-sm font-bold text-white/40">
                        {r.name[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{r.name}</p>
                      <p className="truncate text-[11px] text-white/40">
                        {r.developer || r.storeId}
                        {r.rating ? ` · ${r.rating.toFixed(1)}★` : ""}
                      </p>
                    </div>
                    <ChevronRight size={14} className="shrink-0 text-white/30" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {state.kind === "no-results" && (
            <div className="rounded-xl border border-white/[0.06] bg-[#0d0f14] p-4 text-center">
              <p className="text-sm text-white/60">No matches for &quot;{query}&quot;</p>
              <p className="mt-1 text-[11px] text-white/30">Try a different name or enter manually below.</p>
            </div>
          )}

          {state.kind === "error" && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
              <p className="text-sm text-amber-300">Couldn&apos;t search the store right now.</p>
              <p className="mt-1 text-[11px] text-amber-300/70">Enter your app details manually below.</p>
            </div>
          )}

          {/* Manual entry toggle */}
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="self-start text-[12px] font-medium text-white/40 transition-colors hover:text-white/70"
          >
            {showManual ? "Hide manual entry" : "Can't find your app? Enter manually →"}
          </button>

          {showManual && (
            <div className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-[#0d0f14] p-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-white/60 text-[11px] font-medium uppercase tracking-wide">
                  App name
                </Label>
                <Input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="My Awesome App"
                  className="border-white/[0.08] bg-[#0d0f14] text-white placeholder:text-white/20 focus-visible:ring-[#0A84FF]/50 focus-visible:border-[#0A84FF]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-white/60 text-[11px] font-medium uppercase tracking-wide">
                  {form.platform === "google-play" ? "Package name" : "Bundle ID"}
                </Label>
                <Input
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder={form.platform === "google-play" ? "com.example.app" : "com.example.app"}
                  className="border-white/[0.08] bg-[#0d0f14] text-white placeholder:text-white/20 focus-visible:ring-[#0A84FF]/50 focus-visible:border-[#0A84FF] font-mono text-[12px]"
                />
              </div>
              <Button
                onClick={applyManual}
                disabled={!manualName.trim() || !manualId.trim()}
                className="bg-white/[0.06] text-white hover:bg-white/[0.10] disabled:opacity-40"
              >
                Use these details
              </Button>
            </div>
          )}
        </>
      )}

      {/* Category — only shown after app picked */}
      {form.selectedApp && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">
            Category <span className="text-white/30 normal-case">(optional)</span>
          </Label>
          <p className="text-[11px] text-white/25 -mt-0.5">
            Pre-tunes AI replies. Change anytime in Settings.
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {APP_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => update("appCategory", form.appCategory === cat.id ? null : cat.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
                  form.appCategory === cat.id
                    ? "border-[#0A84FF] bg-[#0A84FF]/10 text-[#0A84FF]"
                    : "border-white/[0.08] bg-[#0d0f14] text-white/50 hover:border-white/20 hover:text-white/80",
                )}
              >
                <span>{cat.emoji}</span>
                <span className="truncate">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={onBack}
          variant="ghost"
          className="h-9 px-3 text-white/50 hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!canContinue}
          className="flex-1 bg-[#0A84FF] text-white hover:bg-[#006EE0] disabled:opacity-40"
        >
          Continue
          <ChevronRight className="ml-1 size-4" strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — Connect                                                     */
/* ------------------------------------------------------------------ */

function StepConnect({
  form,
  onBack,
  onNext,
  saving,
  error,
}: {
  form: FormState;
  onBack: () => void;
  onNext: () => void;
  saving: boolean;
  error: string | null;
}) {
  const isPlay = form.platform === "google-play";

  const features = [
    {
      icon: <Plug className="size-4 text-[#0A84FF]" strokeWidth={1.5} />,
      title: isPlay ? "Google Play sync" : "App Store sync",
      desc: isPlay
        ? "Reviews pulled automatically every 4 hours."
        : "Sync after you add App Store Connect credentials.",
    },
    { icon: <Zap className="size-4 text-amber-400" strokeWidth={1.5} />,         title: "AI triage",          desc: "Every review gets a sentiment score, priority, and issue tags." },
    { icon: <MessageSquare className="size-4 text-emerald-400" strokeWidth={1.5} />, title: "Smart reply drafts", desc: "One-click AI drafts grounded in your knowledge base." },
    { icon: <Bell className="size-4 text-rose-400" strokeWidth={1.5} />,         title: "Spike alerts",       desc: "Email + Slack alert when ratings drop unexpectedly." },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          {isPlay ? "You're almost ready" : "Nearly there"}
        </h2>
        <p className="mt-1 text-sm text-white/40">
          {isPlay
            ? "ReviewBox will start syncing your reviews right after setup."
            : "Apple requires API credentials — add them in Settings after onboarding."}
        </p>
      </div>

      {/* Show what they picked */}
      {form.selectedApp && (
        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0d0f14] p-3">
          {form.selectedApp.icon ? (
            <img src={form.selectedApp.icon} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-sm font-bold text-white/40">
              {form.selectedApp.name[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{form.selectedApp.name}</p>
            <p className="truncate text-[11px] text-white/40">
              {isPlay ? "Google Play" : "App Store"} · {form.selectedApp.storeId}
            </p>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {features.map((f) => (
          <li
            key={f.title}
            className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#0d0f14] px-4 py-3"
          >
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.05]">
              {f.icon}
            </div>
            <div>
              <p className="text-[13px] font-medium text-white/90">{f.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-white/35">{f.desc}</p>
            </div>
          </li>
        ))}
      </ul>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={onBack}
          disabled={saving}
          variant="ghost"
          className="h-9 px-3 text-white/50 hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={saving}
          className="flex-1 bg-[#0A84FF] text-white hover:bg-[#006EE0] disabled:opacity-40"
        >
          {saving ? (
            <><Loader2 className="mr-2 size-4 animate-spin" strokeWidth={2} />Creating workspace…</>
          ) : (
            <>{isPlay ? "Launch my workspace" : "Got it — continue"}<ChevronRight className="ml-1 size-4" strokeWidth={1.5} /></>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — Done                                                        */
/* ------------------------------------------------------------------ */

function StepDone({ onFinish }: { onFinish: () => void | Promise<void> }) {
  const [going, setGoing] = useState(false);

  async function handleFinish() {
    setGoing(true);
    await onFinish();
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0A84FF]/10">
        <Check className="size-9 text-[#0A84FF]" strokeWidth={2.5} />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-white">You&apos;re all set!</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/40">
          Your workspace is ready. Start exploring your reviews.
        </p>
      </div>
      <Button
        onClick={handleFinish}
        disabled={going}
        className="mt-2 w-full bg-[#0A84FF] text-white hover:bg-[#006EE0] disabled:opacity-50"
      >
        {going ? (
          <><Loader2 className="mr-2 size-4 animate-spin" />Taking you in…</>
        ) : (
          <>Go to Dashboard<ChevronRight className="ml-1 size-4" strokeWidth={1.5} /></>
        )}
      </Button>
    </div>
  );
}
