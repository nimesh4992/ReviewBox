import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Platform-admin check for the internal /admin portal.
 *
 * Fail-closed: when ADMIN_CLERK_USER_ID is unset or blank, nobody is admin —
 * a misconfigured deploy must never expose customer data. The env value is
 * trimmed because dashboard copy-paste routinely adds stray whitespace.
 */
export function isAdminUser(
  userId: string | null | undefined,
  adminUserId: string | null | undefined,
): boolean {
  if (!userId) return false;
  const admin = adminUserId?.trim();
  if (!admin) return false;
  return userId === admin;
}

/**
 * Gate for /api/admin/* route handlers. Returns the caller's Clerk user ID
 * when they are the platform admin, null otherwise (caller returns 403).
 */
export async function requireAdminUser(): Promise<string | null> {
  const { userId } = await auth();
  return isAdminUser(userId, process.env.ADMIN_CLERK_USER_ID) ? userId : null;
}

/**
 * Gate for /admin PAGES. Redirects a non-admin away instead of returning null.
 *
 * Every admin page calls this, even though `src/app/admin/layout.tsx` already
 * checks. The layout is not a security boundary: it is one component in a tree,
 * and a page is free to render without it — React Server Components support
 * partial rendering of a subtree, so a request that resolves only the page
 * segment never evaluates the layout's check. Relying on a parent layout for
 * authorization is a documented Next.js anti-pattern for exactly this reason.
 *
 * Six of the seven pages under /admin had no check of their own, and each one
 * calls getServiceClient(), which bypasses RLS and can read every workspace on
 * the platform. The cost of being wrong there is the entire customer database;
 * the cost of this call is one function invocation.
 */
export async function requireAdminPage(): Promise<void> {
  const { userId } = await auth();
  if (!isAdminUser(userId, process.env.ADMIN_CLERK_USER_ID)) {
    redirect("/dashboard");
  }
}
