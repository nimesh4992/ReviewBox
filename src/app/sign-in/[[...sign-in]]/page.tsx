import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth/auth-shell";
import { CLERK_APPEARANCE } from "@/components/auth/clerk-appearance";

export default function SignInPage() {
  return (
    <AuthShell
      heading="Welcome back"
      subheading="Sign in to your ReviewBox workspace."
      footer={
        <>
          New to ReviewBox?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-[#0A84FF] hover:text-[#006EE0]"
          >
            Create an account
          </Link>
        </>
      }
    >
      <SignIn signUpUrl="/sign-up" appearance={CLERK_APPEARANCE} />
    </AuthShell>
  );
}
