import Link from "next/link";
import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { AuthShell } from "@/components/auth/auth-shell";
import { CLERK_APPEARANCE } from "@/components/auth/clerk-appearance";

export default async function SignInPage() {
  // If the user already has a valid session, don't show an empty SignIn form —
  // Clerk's component renders nothing when a session exists. Redirect to the
  // app instead so the user understands what happened.
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
