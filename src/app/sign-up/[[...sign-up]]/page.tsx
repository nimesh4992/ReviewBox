"use client";

import { useState } from "react";
import { SignUp } from "@clerk/nextjs";

const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: "#0A84FF",
    colorBackground: "#ffffff",
    colorText: "#1D1D1F",
    colorTextSecondary: "#86868B",
    colorInputBackground: "#ffffff",
    colorInputText: "#1D1D1F",
    colorNeutral: "#86868B",
    borderRadius: "10px",
    fontFamily: "inherit",
    fontSize: "14px",
  },
  elements: {
    rootBox: "w-full",
    card: "shadow-[0_2px_24px_rgba(0,0,0,0.08)] border border-black/[0.06] bg-white rounded-[18px] p-2",
    headerTitle: "text-[#1D1D1F] font-semibold tracking-[-0.015em]",
    headerSubtitle: "text-[#86868B]",
    socialButtonsBlockButton: "border border-black/[0.08] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] shadow-none font-medium",
    socialButtonsBlockButtonText: "text-[#1D1D1F] font-medium",
    dividerLine: "bg-black/[0.07]",
    dividerText: "text-[#86868B] text-xs",
    formFieldLabel: "text-[#48484D] text-xs font-medium",
    formFieldInput: "bg-white border-black/[0.12] text-[#1D1D1F] rounded-[8px] focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/20 h-9 text-[13px]",
    formButtonPrimary: "bg-[#0A84FF] hover:bg-[#006EE0] text-white shadow-none font-semibold rounded-[8px] h-9 text-[13px]",
    footerActionLink: "text-[#0A84FF] hover:text-[#006EE0] font-medium",
    footerActionText: "text-[#86868B] text-[13px]",
    formFieldInputShowPasswordButton: "text-[#86868B]",
    alertText: "text-[13px]",
    formResendCodeLink: "text-[#0A84FF]",
  },
} as const;

export default function SignUpPage() {
  const [agreed, setAgreed] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-16"
      style={{
        background: "#F5F5F7",
        backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-[14px] bg-[#0A84FF] shadow-[0_4px_20px_rgba(10,132,255,0.30)]">
          <span className="text-[18px] font-bold tracking-tight text-white">R</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[22px] font-semibold tracking-[-0.02em] text-[#1D1D1F]">ReviewBox</span>
          <span className="text-[13px] text-[#86868B]">App Review Intelligence</span>
        </div>
      </div>

      {/* Terms gate */}
      {!showSignUp && (
        <div className="w-full max-w-[400px] rounded-[18px] border border-black/[0.06] bg-white p-7 shadow-[0_2px_24px_rgba(0,0,0,0.08)]">
          <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-[#1D1D1F]">
            Before we start
          </h2>
          <p className="mt-1 text-[13px] text-[#86868B]">
            Please review and accept our terms to continue.
          </p>

          <label className="mt-5 flex cursor-pointer items-start gap-3">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`flex size-4 items-center justify-center rounded border-2 transition-colors ${
                  agreed ? "border-[#0A84FF] bg-[#0A84FF]" : "border-black/[0.15] bg-white"
                }`}
              >
                {agreed && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-[13px] leading-relaxed text-[#48484D]">
              I agree to the{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#0A84FF] underline-offset-2 hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0A84FF] underline-offset-2 hover:underline">
                Privacy Policy
              </a>
            </span>
          </label>

          <button
            disabled={!agreed}
            onClick={() => setShowSignUp(true)}
            className="mt-5 w-full rounded-[8px] bg-[#0A84FF] py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#006EE0] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to sign up
          </button>
        </div>
      )}

      {showSignUp && (
        <SignUp
          signInUrl="/sign-in"
          appearance={CLERK_APPEARANCE}
        />
      )}
    </div>
  );
}
