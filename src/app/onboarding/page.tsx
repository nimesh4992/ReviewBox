"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";

import { Check, ChevronRight, Plug, X, Loader2, Zap, MessageSquare, Bell } from "lucide-react";
import { track } from "@/lib/analytics";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { APP_CATEGORIES, type AppCategory } from "@/lib/brand-voice-stubs";

type Platform = "google-play" | "app-store";

interface FormState {
  workspaceName: string;
  workspaceSlug: string;
  appName: string;
  platform: Platform;
  storeId: string;
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
  const router = useRouter();
  const { session } = useClerk();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    workspaceName: "",
    workspaceSlug: "",
    appName: "",
    platform: "google-play",
    storeId: "",
    appCategory: null,
  });
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ state: "idle" });
  const [saving, setSaving] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resume: hydrate from server state on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/state");
        if (!res.ok) return;
        const data = await res.json() as {
          onboarded: boolean;
          hasWorkspace: boolean;
          hasApp: boolean;
          workspace: { name: string; slug: string } | null;
          app: { name: string; platform: string; storeId: string } | null;
        };
        if (cancelled) return;

        if (data.onboarded) {
          // Reload session so middleware sees fresh JWT before navigating.
          // If reload fails (e.g. Clerk hiccup), still navigate — the JWT
          // will refresh naturally within 60s and the user just gets one
          // extra middleware bounce instead of being stuck on this page.
          try { await session?.reload(); } catch { /* non-fatal */ }
          window.location.href = "/dashboard";
          return;
        }

        setForm((prev) => ({
          ...prev,
          workspaceName: data.workspace?.name ?? prev.workspaceName,
          workspaceSlug: data.workspace?.slug ?? prev.workspaceSlug,
          appName: data.app?.name ?? prev.appName,
          platform: data.app?.platform === "app_store" ? "app-store" : prev.platform,
          storeId: data.app?.storeId ?? prev.storeId,
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
  }, [router]);

  // Debounced slug availability check.
  // Safety: if the check hangs or errors, fall back to "idle" after 4s
  // so the user is never stuck. Server-side /api/onboarding/complete
  // re-validates and returns SLUG_TAKEN (409) if there's a conflict.
  useEffect(() => {
    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
    const slug = form.workspaceSlug.trim();
    if (!slug) {
      setSlugStatus({ state: "idle" });
      return;
    }
    setSlugStatus({ state: "checking" });

    // Timeout safety: never stay "checking" longer than 4s.
    const fallback = setTimeout(() => {
      setSlugStatus({ state: "idle" });
    }, 4000);

    slugCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/onboarding/slug-check?slug=${encodeURIComponent(slug)}`);
        clearTimeout(fallback);
        if (!res.ok) {
          // Endpoint failed; let the user proceed — server complete validates.
          setSlugStatus({ state: "idle" });
          return;
        }
        const data = await res.json() as {
          available: boolean;
          reason?: "INVALID" | "RESERVED" | "TAKEN";
          suggestions: string[];
        };
        if (data.available) {
          setSlugStatus({ state: "available" });
        } else if (data.reason === "INVALID") {
          setSlugStatus({ state: "invalid" });
        } else if (data.reason === "RESERVED") {
          setSlugStatus({ state: "reserved", suggestions: data.suggestions });
        } else {
          setSlugStatus({ state: "taken", suggestions: data.suggestions });
        }
      } catch {
        // Network error — let the user proceed; server complete validates.
        clearTimeout(fallback);
        setSlugStatus({ state: "idle" });
      }
    }, 400);
    return () => {
      if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
      clearTimeout(fallback);
    };
  }, [form.workspaceSlug]);

  const update = (key: keyof FormState, value: string | AppCategory | null) => {
    if (key === "workspaceName" || key === "workspaceSlug") {
      setSlugError(null);
    }
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "workspaceName" && typeof value === "string") {
        next.workspaceSlug = slugify(value);
      }
      return next;
    });
  };

  const next = () => setStep((s) => Math.min(s + 1, 4));

  // Called when the user clicks Continue / Skip on step 3 (Connect)
  const saveAndAdvance = async () => {
    setSaving(true);
    setSlugError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: form.workspaceName,
          workspaceSlug: form.workspaceSlug,
          appName: form.appName,
          platform: form.platform,
          storeId: form.storeId,
          appCategory: form.appCategory,
        }),
      });

      if (res.status === 409) {
        setSlugError("Workspace URL already taken — try a different one.");
        // Go back to step 1 so user can fix the slug
        setStep(1);
        return;
      }

      if (!res.ok) {
        setSlugError("Something went wrong. Please try again.");
        return;
      }

      await res.json() as OnboardingResult;
      track({ name: "onboarding_completed", properties: { platform: form.platform } });
      next();
    } catch {
      setSlugError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0d0f14] px-4 py-12">
      {/* Logo mark */}
      <div className="mb-10 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A84FF]">
          <span className="text-sm font-bold text-white">R</span>
        </div>
        <span className="text-lg font-semibold tracking-tight text-white">
          ReviewBox
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#1a1d27] p-8">
        {/* Step dots + progress bar */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const active = n === step;
              const done = n < step;
              return (
                <div key={s.label} className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                      done && "bg-[#0A84FF] text-white",
                      active && "bg-[#0A84FF] text-white ring-2 ring-[#0A84FF]/30",
                      !done && !active && "bg-white/[0.06] text-white/30",
                    )}
                  >
                    {done ? "✓" : n}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      active ? "text-white/70" : "text-white/25",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Progress bar */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[#0A84FF] transition-all duration-500"
              style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        {hydrating && (
          <div className="flex items-center justify-center py-20 text-white/40">
            <Loader2 className="size-5 animate-spin" strokeWidth={1.5} />
          </div>
        )}
        {!hydrating && step === 1 && (
          <StepWorkspace
            form={form}
            update={update}
            onNext={next}
            slugError={slugError}
            slugStatus={slugStatus}
          />
        )}
        {!hydrating && step === 2 && (
          <StepApp form={form} update={update} onNext={next} />
        )}
        {!hydrating && step === 3 && (
          <StepConnect platform={form.platform} onNext={saveAndAdvance} saving={saving} />
        )}
        {!hydrating && step === 4 && (
          <StepDone onFinish={async () => {
            // Reload session so middleware sees onboarded=true before we navigate.
            // Non-fatal if reload throws — the JWT refreshes within 60s anyway.
            try { await session?.reload(); } catch { /* non-fatal */ }
            window.location.href = "/dashboard";
          }} />
        )}
      </div>

      {/* Step counter */}
      <p className="mt-6 text-xs text-white/20">
        Step {step} of {STEPS.length}
      </p>
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
  update: (k: keyof FormState, v: string) => void;
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

  // Allow proceed in any state except hard-fail ones (taken/reserved/invalid).
  // While we're still checking, server complete validates anyway — so we
  // don't trap the user behind a slow or failed slug-check API call.
  const canContinue =
    form.workspaceName.trim().length > 0 &&
    slugStatus.state !== "taken" &&
    slugStatus.state !== "reserved" &&
    slugStatus.state !== "invalid";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Tell us about your workspace
        </h2>
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
              {slugStatus.state === "checking" && (
                <Loader2 className="size-4 animate-spin text-white/30" strokeWidth={1.5} />
              )}
              {slugStatus.state === "available" && (
                <Check className="size-4 text-emerald-400" strokeWidth={2} />
              )}
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
/* Step 2 — App                                                         */
/* ------------------------------------------------------------------ */

function StepApp({
  form,
  update,
  onNext,
}: {
  form: FormState;
  update: (k: keyof FormState, v: string | AppCategory | null) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Add your first app</h2>
        <p className="mt-1 text-sm text-white/40">
          You can add more apps later from Settings.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">
            App name
          </Label>
          <Input
            value={form.appName}
            onChange={(e) => update("appName", e.target.value)}
            placeholder="My Awesome App"
            className="border-white/[0.08] bg-[#0d0f14] text-white placeholder:text-white/20 focus-visible:ring-[#0A84FF]/50 focus-visible:border-[#0A84FF]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">
            Platform
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "google-play", label: "Google Play" },
                { value: "app-store", label: "App Store" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("platform", opt.value)}
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

        <div className="flex flex-col gap-1.5">
          <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">
            Store ID
          </Label>
          <Input
            value={form.storeId}
            onChange={(e) => update("storeId", e.target.value)}
            placeholder={
              form.platform === "google-play"
                ? "com.example.app"
                : "123456789"
            }
            className="border-white/[0.08] bg-[#0d0f14] text-white placeholder:text-white/20 focus-visible:ring-[#0A84FF]/50 focus-visible:border-[#0A84FF]"
          />
          <p className="text-[11px] text-white/25">
            Google Play:{" "}
            <code className="font-mono text-white/40">com.example.app</code>
            {" · "}App Store:{" "}
            <code className="font-mono text-white/40">numeric ID</code>
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-white/60 text-xs font-medium uppercase tracking-wide">
            Category <span className="text-white/30 normal-case">(optional)</span>
          </Label>
          <p className="text-[11px] text-white/25 -mt-0.5">
            We use this to pre-tune your AI replies. You can change it later.
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
      </div>

      <Button
        onClick={onNext}
        disabled={!form.appName.trim() || !form.storeId.trim()}
        className="w-full bg-[#0A84FF] text-white hover:bg-[#006EE0] disabled:opacity-40"
      >
        Continue
        <ChevronRight className="ml-1 size-4" strokeWidth={1.5} />
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — Connect                                                     */
/* ------------------------------------------------------------------ */

function StepConnect({
  platform,
  onNext,
  saving,
}: {
  platform: Platform;
  onNext: () => void;
  saving: boolean;
}) {
  const isPlay = platform === "google-play";

  const features = [
    {
      icon: <Plug className="size-4 text-[#0A84FF]" strokeWidth={1.5} />,
      title: isPlay ? "Google Play sync" : "App Store sync",
      desc: isPlay
        ? "Reviews pulled automatically every 4 hours."
        : "Sync after you add App Store Connect credentials.",
    },
    {
      icon: <Zap className="size-4 text-amber-400" strokeWidth={1.5} />,
      title: "AI triage",
      desc: "Every review gets a sentiment score, priority, and issue tags.",
    },
    {
      icon: <MessageSquare className="size-4 text-emerald-400" strokeWidth={1.5} />,
      title: "Smart reply drafts",
      desc: "One-click AI drafts grounded in your knowledge base.",
    },
    {
      icon: <Bell className="size-4 text-rose-400" strokeWidth={1.5} />,
      title: "Spike alerts",
      desc: "Email + Slack alert when ratings drop unexpectedly.",
    },
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

      <Button
        onClick={onNext}
        disabled={saving}
        className="w-full bg-[#0A84FF] text-white hover:bg-[#006EE0] disabled:opacity-40"
      >
        {saving ? (
          <><Loader2 className="mr-2 size-4 animate-spin" strokeWidth={2} />Creating workspace…</>
        ) : (
          <>{isPlay ? "Launch my workspace" : "Got it — continue"}<ChevronRight className="ml-1 size-4" strokeWidth={1.5} /></>
        )}
      </Button>
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
