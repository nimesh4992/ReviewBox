"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ChevronRight, ExternalLink, Plug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Platform = "google-play" | "app-store";

interface FormState {
  workspaceName: string;
  workspaceSlug: string;
  appName: string;
  platform: Platform;
  storeId: string;
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

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    workspaceName: "",
    workspaceSlug: "",
    appName: "",
    platform: "google-play",
    storeId: "",
  });
  const [slugError, setSlugError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (key: keyof FormState, value: string) => {
    if (key === "workspaceName" || key === "workspaceSlug") {
      setSlugError(null);
    }
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "workspaceName") {
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
        {step === 1 && (
          <StepWorkspace form={form} update={update} onNext={next} slugError={slugError} />
        )}
        {step === 2 && (
          <StepApp form={form} update={update} onNext={next} />
        )}
        {step === 3 && (
          <StepConnect platform={form.platform} onNext={saveAndAdvance} saving={saving} />
        )}
        {step === 4 && (
          <StepDone onFinish={() => router.push("/dashboard")} />
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
}: {
  form: FormState;
  update: (k: keyof FormState, v: string) => void;
  onNext: () => void;
  slugError: string | null;
}) {
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
          <div className={cn(
            "flex items-center overflow-hidden rounded-lg border bg-[#0d0f14] focus-within:border-[#0A84FF]",
            slugError ? "border-red-500/60" : "border-white/[0.08]",
          )}>
            <span className="select-none border-r border-white/[0.08] px-3 py-2 text-sm text-white/30">
              tryreviewbox.com/
            </span>
            <input
              value={form.workspaceSlug}
              onChange={(e) => update("workspaceSlug", slugify(e.target.value))}
              placeholder="acme-inc"
              className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/20"
            />
          </div>
          {slugError && (
            <p className="text-xs text-red-400">{slugError}</p>
          )}
        </div>
      </div>

      <Button
        onClick={onNext}
        disabled={!form.workspaceName.trim()}
        className="w-full bg-[#0A84FF] text-white hover:bg-[#006EE0] disabled:opacity-40"
      >
        Continue
        <ChevronRight className="ml-1 size-4" strokeWidth={1.5} />
      </Button>
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
  update: (k: keyof FormState, v: string) => void;
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          {isPlay
            ? "Connect to Google Play Console"
            : "Connect to App Store Connect"}
        </h2>
        <p className="mt-1 text-sm text-white/40">
          Authorize ReviewBox to read your reviews and reply on your behalf.
        </p>
      </div>

      {/* OAuth card */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0d0f14] p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
            <Plug className="size-5 text-white/40" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">
              {isPlay ? "Google Play Console" : "App Store Connect"}
            </p>
            <p className="mt-0.5 text-xs text-white/35">
              {isPlay
                ? "OAuth 2.0 — read & reply permissions"
                : "API key — read & reply permissions"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="relative group">
            <button
              disabled
              className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/25 transition-colors"
            >
              <ExternalLink className="size-4" strokeWidth={1.5} />
              Authorize with {isPlay ? "Google" : "Apple"}
            </button>
            {/* Tooltip */}
            <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden w-56 rounded-lg border border-white/[0.08] bg-[#1a1d27] px-3 py-2 text-xs text-white/60 shadow-xl group-hover:block">
              Setting up — available in 48h
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Button
          onClick={onNext}
          disabled={saving}
          className="w-full bg-[#0A84FF] text-white hover:bg-[#006EE0] disabled:opacity-40"
        >
          {saving ? "Saving…" : "Continue"}
          {!saving && <ChevronRight className="ml-1 size-4" strokeWidth={1.5} />}
        </Button>
        <button
          onClick={onNext}
          disabled={saving}
          className="text-center text-sm text-white/30 underline-offset-2 hover:text-white/50 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — Done                                                        */
/* ------------------------------------------------------------------ */

function StepDone({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0A84FF]/10 text-5xl">
        🎉
      </div>
      <div>
        <h2 className="text-xl font-semibold text-white">You&apos;re all set!</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/40">
          Your workspace is ready. Start exploring your reviews.
        </p>
      </div>
      <Button
        onClick={onFinish}
        className="mt-2 w-full bg-[#0A84FF] text-white hover:bg-[#006EE0]"
      >
        Go to Dashboard
        <ChevronRight className="ml-1 size-4" strokeWidth={1.5} />
      </Button>
    </div>
  );
}
