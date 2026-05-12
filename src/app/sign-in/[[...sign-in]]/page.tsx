import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
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

      {/* Clerk SignIn */}
      <SignIn
        signUpUrl="/sign-up"
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
    </div>
  );
}
