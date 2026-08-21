import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { CLERK_APPEARANCE } from "@/components/auth/clerk-appearance";

export default async function SignUpPage() {
  // Already signed in → skip the blank form, send them onward.
  try {
    const { userId } = await auth();
    if (userId) {
      redirect("/dashboard");
    }
  } catch {
    // Public page isolation: auth() throws if clerkMiddleware did not run or during auth outages
  }

  return (
    <AuthShell
      heading="Create your account"
      subheading="14-day free trial. No credit card required."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-[#0A84FF] hover:text-[#006EE0]"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignUp signInUrl="/sign-in" appearance={CLERK_APPEARANCE} />

      <p className="mt-5 text-center text-[12px] leading-relaxed text-[var(--rb-fg-3)]">
        By creating an account, you agree to the{" "}
        <Link
          href="https://tryreviewbox.com/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#0A84FF] underline-offset-2 hover:underline"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="https://tryreviewbox.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#0A84FF] underline-offset-2 hover:underline"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </AuthShell>
  );
}
