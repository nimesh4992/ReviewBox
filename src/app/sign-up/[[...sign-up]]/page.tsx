"use client";

import { useState } from "react";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  const [agreed, setAgreed] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0d0f14] px-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#5B5BD6]">
          <span className="text-xl font-bold tracking-tight text-white">R</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-semibold tracking-tight text-white">
            Revi
          </span>
          <span className="text-sm text-white/40">App Review Intelligence</span>
        </div>
      </div>

      {/* Step 1 — terms gate */}
      {!showSignUp && (
        <div className="w-full max-w-sm rounded-xl border border-white/[0.08] bg-[#1a1d27] p-6">
          <h2 className="mb-1 text-base font-semibold text-white">
            Before we start
          </h2>
          <p className="mb-5 text-sm text-white/40">
            Please review and accept our terms to continue.
          </p>

          {/* Checkbox row */}
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#5B5BD6]"
            />
            <span className="text-sm text-white/60 leading-relaxed">
              I agree to the{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5B5BD6] underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5B5BD6] underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Privacy Policy
              </a>
            </span>
          </label>

          {/* Continue button */}
          <button
            disabled={!agreed}
            onClick={() => setShowSignUp(true)}
            className="mt-5 w-full rounded-lg bg-[#5B5BD6] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to sign up
          </button>
        </div>
      )}

      {/* Step 2 — Clerk SignUp */}
      {showSignUp && (
        <SignUp
          signInUrl="/sign-in"
          appearance={{
            variables: {
              colorPrimary: "#5B5BD6",
              colorBackground: "#1a1d27",
              colorText: "#f1f5f9",
              colorTextSecondary: "#94a3b8",
              colorInputBackground: "#0d0f14",
              colorInputText: "#f1f5f9",
              borderRadius: "0.75rem",
              fontFamily: "inherit",
            },
            elements: {
              card: "shadow-none border border-white/[0.08] bg-[#1a1d27]",
              headerTitle: "text-white",
              headerSubtitle: "text-white/40",
              socialButtonsBlockButton:
                "border-white/[0.08] bg-white/[0.04] text-white hover:bg-white/[0.08]",
              dividerLine: "bg-white/[0.08]",
              dividerText: "text-white/30",
              formFieldLabel: "text-white/60",
              formFieldInput:
                "bg-[#0d0f14] border-white/[0.08] text-white focus:border-[#5B5BD6]",
              footerActionLink: "text-[#5B5BD6] hover:text-[#7878e8]",
              formButtonPrimary:
                "bg-[#5B5BD6] hover:bg-[#4e4ec4] text-white shadow-none",
            },
          }}
        />
      )}
    </div>
  );
}
