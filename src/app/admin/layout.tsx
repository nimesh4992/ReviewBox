import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { isAdminUser } from "@/lib/admin-auth";

/**
 * Same reasoning as the (app) layout: say it in the markup, so it holds on
 * every hostname and not just the one middleware knows to add a header to.
 * `isAdminUser` below is the access control — this is only about crawlers.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/analytics", label: "Analytics" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!isAdminUser(userId, process.env.ADMIN_CLERK_USER_ID)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-[200px] shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Admin</p>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-gray-200 p-3">
          <Link
            href="/dashboard"
            className="block rounded-lg px-3 py-2 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ← Back to app
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
