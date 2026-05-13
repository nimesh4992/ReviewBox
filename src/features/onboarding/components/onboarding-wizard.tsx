"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Connect stores" },
  { id: 2, label: "Pick apps"      },
  { id: 3, label: "Invite team"    },
  { id: 4, label: "Set alerts"     },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const done    = step.id < current;
        const active  = step.id === current;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-[12px] font-semibold transition-colors",
                  done   ? "bg-[#0A84FF] text-white"
                         : active ? "border-2 border-[#0A84FF] text-[#0A84FF] bg-surface"
                                  : "border border-[var(--rb-border-2)] text-fg-3 bg-surface",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={2.5} /> : step.id}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium whitespace-nowrap",
                  active ? "text-fg-1" : done ? "text-[#0A84FF]" : "text-fg-3",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-3 mb-4 h-px w-16 transition-colors",
                  step.id < current ? "bg-[#0A84FF]" : "bg-[var(--rb-border-1)]",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1 — Connect stores ───────────────────────────────────────────────────

const STORES = [
  {
    id: "google-play",
    name: "Google Play",
    icon: "🟢",
    description: "Android apps on Google Play Console",
  },
  {
    id: "app-store",
    name: "App Store",
    icon: "🍎",
    description: "iOS / macOS apps on App Store Connect",
  },
];

function Step1({ onNext }: { onNext: () => void }) {
  const [connected, setConnected] = useState<string[]>([]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-fg-1">Connect your stores</h2>
        <p className="mt-1 text-[13px] text-fg-3">Authorize Revi to read your reviews and reply on your behalf.</p>
      </div>

      <div className="flex flex-col gap-3">
        {STORES.map((store) => {
          const done = connected.includes(store.id);
          return (
            <div
              key={store.id}
              className={cn(
                "flex items-center gap-4 rounded-[12px] border p-4 transition-colors",
                done
                  ? "border-[#0A84FF]/30 bg-[#0A84FF]/[0.04]"
                  : "border-[var(--rb-border-1)] bg-surface",
              )}
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--rb-bg-sunken)] text-[20px]">
                {store.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-fg-1">{store.name}</div>
                <div className="text-[12px] text-fg-3">{store.description}</div>
              </div>
              <button
                onClick={() =>
                  setConnected((prev) =>
                    done ? prev.filter((id) => id !== store.id) : [...prev, store.id],
                  )
                }
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-3 text-[12px] font-semibold transition-colors",
                  done
                    ? "bg-[#1F8A5B]/10 text-[#1F8A5B]"
                    : "bg-[#0A84FF] text-white hover:bg-[#006EE0]",
                )}
              >
                {done ? <><Check className="size-3" strokeWidth={2.5} /> Connected</> : "Connect"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button className="text-[12px] text-fg-3 hover:text-fg-2 underline underline-offset-2">
          Skip for now
        </button>
        <button
          onClick={onNext}
          disabled={connected.length === 0}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-[#0A84FF] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#006EE0] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue <ChevronRight className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ── Step 2 — Pick apps ────────────────────────────────────────────────────────

const MOCK_APPS = [
  { id: "1", name: "Acme Banking",     platform: "Google Play", icon: "🏦" },
  { id: "2", name: "Acme Banking",     platform: "App Store",   icon: "🏦" },
  { id: "3", name: "Acme Pay",         platform: "Google Play", icon: "💳" },
  { id: "4", name: "Acme Investments", platform: "App Store",   icon: "📈" },
];

function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [selected, setSelected] = useState<string[]>(["1", "2"]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-fg-1">Pick your apps</h2>
        <p className="mt-1 text-[13px] text-fg-3">Choose which apps Revi should monitor. You can change this later.</p>
      </div>

      <div className="flex flex-col gap-2">
        {MOCK_APPS.map((app) => {
          const active = selected.includes(app.id);
          return (
            <button
              key={app.id}
              onClick={() => toggle(app.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-[10px] border px-4 py-3 text-left transition-colors",
                active
                  ? "border-[#0A84FF]/30 bg-[#0A84FF]/[0.04]"
                  : "border-[var(--rb-border-1)] bg-surface hover:bg-[var(--rb-bg-hover)]",
              )}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--rb-bg-sunken)] text-[18px]">
                {app.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-fg-1">{app.name}</div>
                <div className="text-[11px] text-fg-3">{app.platform}</div>
              </div>
              <div
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                  active ? "border-[#0A84FF] bg-[#0A84FF]" : "border-[var(--rb-border-2)]",
                )}
              >
                {active && <Check className="size-3 text-white" strokeWidth={3} />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-[12px] text-fg-3 hover:text-fg-2">
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={selected.length === 0}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-[#0A84FF] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#006EE0] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue <ChevronRight className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ── Step 3 — Invite team ──────────────────────────────────────────────────────

function Step3({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<string[]>([]);

  function addInvite() {
    const trimmed = email.trim();
    if (trimmed && !invites.includes(trimmed)) {
      setInvites((prev) => [...prev, trimmed]);
      setEmail("");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-fg-1">Invite your team</h2>
        <p className="mt-1 text-[13px] text-fg-3">Teammates get access to reviews, replies, and reports.</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addInvite()}
            className="flex-1 rounded-[8px] border border-[var(--rb-border-1)] bg-surface px-3 py-2 text-[13px] text-fg-1 placeholder:text-fg-3 outline-none focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/20 transition-shadow"
          />
          <button
            onClick={addInvite}
            className="flex h-9 items-center gap-1.5 rounded-[8px] border border-[var(--rb-border-1)] bg-surface px-3 text-[13px] font-semibold text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)]"
          >
            <Plus className="size-4" strokeWidth={2} /> Add
          </button>
        </div>

        {invites.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {invites.map((inv) => (
              <div
                key={inv}
                className="flex items-center justify-between rounded-[8px] border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-3 py-2"
              >
                <span className="text-[13px] text-fg-2">{inv}</span>
                <button
                  onClick={() => setInvites((prev) => prev.filter((x) => x !== inv))}
                  className="text-fg-3 hover:text-fg-1 transition-colors"
                >
                  <X className="size-3.5" strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-[12px] text-fg-3 hover:text-fg-2">
          ← Back
        </button>
        <div className="flex items-center gap-3">
          <button onClick={onNext} className="text-[12px] text-fg-3 hover:text-fg-2 underline underline-offset-2">
            Skip
          </button>
          <button
            onClick={onNext}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-[#0A84FF] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#006EE0]"
          >
            {invites.length > 0 ? `Send ${invites.length} invite${invites.length > 1 ? "s" : ""}` : "Continue"} <ChevronRight className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 4 — Set alerts ───────────────────────────────────────────────────────

const ALERT_OPTIONS = [
  { id: "rating-drop",  label: "Rating drop",     description: "Alert when avg rating falls > 0.2★ in 24h" },
  { id: "crash-spike",  label: "Crash spike",      description: "Alert when 5+ reviews mention crashes in 1h"  },
  { id: "sla-breach",   label: "SLA breach",       description: "Alert when a review goes 48h without reply"   },
  { id: "competitor",   label: "Competitor surge", description: "Alert when a competitor gains 0.3★ in a week" },
];

function Step4({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  const [enabled, setEnabled] = useState<string[]>(["rating-drop", "crash-spike", "sla-breach"]);

  function toggle(id: string) {
    setEnabled((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-fg-1">Set your alerts</h2>
        <p className="mt-1 text-[13px] text-fg-3">Get notified when something needs your attention. All alerts go to your email and in-app.</p>
      </div>

      <div className="flex flex-col gap-2">
        {ALERT_OPTIONS.map((opt) => {
          const on = enabled.includes(opt.id);
          return (
            <div
              key={opt.id}
              className={cn(
                "flex items-center gap-3 rounded-[10px] border px-4 py-3 transition-colors",
                on ? "border-[#0A84FF]/30 bg-[#0A84FF]/[0.04]" : "border-[var(--rb-border-1)] bg-surface",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-fg-1">{opt.label}</div>
                <div className="text-[11px] text-fg-3">{opt.description}</div>
              </div>
              <button
                role="switch"
                aria-checked={on}
                onClick={() => toggle(opt.id)}
                className={cn(
                  "relative shrink-0 h-5 w-9 rounded-full transition-colors",
                  on ? "bg-[#0A84FF]" : "bg-[var(--rb-border-2)]",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
                    on ? "translate-x-4" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-[12px] text-fg-3 hover:text-fg-2">
          ← Back
        </button>
        <button
          onClick={onFinish}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-[#0A84FF] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#006EE0]"
        >
          Finish setup <Check className="size-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

// ── Wizard shell ──────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const router = useRouter();

  function next() { setStep((s) => Math.min(s + 1, 4)); }
  function back() { setStep((s) => Math.max(s - 1, 1)); }
  function finish() { router.push("/dashboard"); }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-16">
      {/* Logo */}
      <div className="mb-10 flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-[10px] bg-[#0A84FF] text-[13px] font-bold text-white">
          R
        </div>
        <span className="text-[16px] font-semibold tracking-tight text-fg-1">Revi</span>
      </div>

      {/* Step indicator */}
      <div className="mb-8">
        <StepIndicator current={step} />
      </div>

      {/* Card */}
      <div className="w-full max-w-[480px] rounded-[18px] border border-[var(--rb-border-1)] bg-surface p-8 shadow-[var(--rb-shadow-md)]">
        {step === 1 && <Step1 onNext={next} />}
        {step === 2 && <Step2 onNext={next} onBack={back} />}
        {step === 3 && <Step3 onNext={next} onBack={back} />}
        {step === 4 && <Step4 onFinish={finish} onBack={back} />}
      </div>

      <p className="mt-6 text-[11px] text-fg-3">
        Step {step} of {STEPS.length}
      </p>
    </div>
  );
}
