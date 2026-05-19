/**
 * Shared Clerk appearance config for /sign-in and /sign-up.
 *
 * Matches the ReviewBox design system: brand blue, --rb-* token-aligned
 * neutrals, 10px corner radius, system font. Layout config points the
 * Clerk-managed footer links at the marketing site, not the app subdomain.
 */

// Loose structural type so we don't take a direct dep on @clerk/types
// — the appearance object is consumed by the runtime SDK which accepts
// `Record<string, unknown>` for layout/elements without complaint.
type Appearance = {
  layout?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  elements?: Record<string, string>;
};

export const CLERK_APPEARANCE: Appearance = {
  layout: {
    privacyPageUrl: "https://tryreviewbox.com/privacy",
    termsPageUrl: "https://tryreviewbox.com/terms",
    helpPageUrl: "https://tryreviewbox.com/help",
    socialButtonsVariant: "blockButton",
    socialButtonsPlacement: "top",
  },
  variables: {
    colorPrimary: "#0A84FF",
    colorBackground: "#FFFFFF",
    colorText: "#1D1D1F",
    colorTextSecondary: "#86868B",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#1D1D1F",
    colorNeutral: "#86868B",
    colorDanger: "#DC2626",
    colorSuccess: "#1F8A5B",
    colorWarning: "#C97A00",
    borderRadius: "10px",
    fontFamily: "inherit",
    fontSize: "14px",
  },
  elements: {
    rootBox: "w-full",
    // Hide Clerk's outer card — our AuthShell provides the visual frame
    card: "shadow-none border-0 bg-transparent p-0 w-full",
    // Hide Clerk's own header (we render our own heading above)
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    // OAuth buttons
    socialButtonsBlockButton:
      "border border-black/[0.08] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7] " +
      "shadow-none font-medium h-10 rounded-[10px] transition-colors",
    socialButtonsBlockButtonText: "text-[#1D1D1F] font-medium text-[13.5px]",
    socialButtonsBlockButtonArrow: "text-[#86868B]",
    dividerLine: "bg-black/[0.07]",
    dividerText: "text-[#86868B] text-[12px] uppercase tracking-wider font-medium",
    // Form fields
    formFieldLabel: "text-[#48484D] text-[12px] font-medium",
    formFieldInput:
      "bg-white border border-black/[0.12] text-[#1D1D1F] rounded-[10px] " +
      "focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/15 " +
      "h-10 text-[14px] px-3 transition-shadow",
    formFieldInputShowPasswordButton: "text-[#86868B] hover:text-[#48484D]",
    formFieldInfoText: "text-[#86868B] text-[12px]",
    formFieldHintText: "text-[#86868B] text-[12px]",
    formFieldErrorText: "text-[#DC2626] text-[12px]",
    // Primary button (Continue, Sign in)
    formButtonPrimary:
      "bg-[#0A84FF] hover:bg-[#006EE0] text-white shadow-none " +
      "font-semibold rounded-[10px] h-10 text-[14px] transition-colors " +
      "disabled:bg-[#0A84FF]/40 disabled:cursor-not-allowed",
    // Footer link ("Forgot password?", "Resend code")
    footerActionLink: "text-[#0A84FF] hover:text-[#006EE0] font-medium",
    footerActionText: "text-[#86868B] text-[13px]",
    // Hide Clerk's switch-flow footer — we render our own under the form
    footer: "hidden",
    // Verification screens
    identityPreviewText: "text-[#1D1D1F] text-[14px]",
    identityPreviewEditButtonIcon: "text-[#0A84FF]",
    formResendCodeLink: "text-[#0A84FF] hover:text-[#006EE0] font-medium",
    // Alert (errors at top of form)
    alert: "rounded-[10px] border border-red-200 bg-red-50 p-3",
    alertText: "text-[13px] text-red-700",
    // OTP code input
    otpCodeFieldInput:
      "border border-black/[0.12] rounded-[10px] focus:border-[#0A84FF] " +
      "focus:ring-2 focus:ring-[#0A84FF]/15 text-[16px] font-semibold",
  },
};
