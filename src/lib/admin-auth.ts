import { auth } from "@clerk/nextjs/server";

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
