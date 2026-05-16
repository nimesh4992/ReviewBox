import Link from "next/link";

interface MarketingNavProps {
  cta?: "trial" | "signin";
}

const NAV_LINKS = [
  { label: "Pricing",   href: "/pricing" },
  { label: "Compare",   href: "/compare" },
  { label: "Customers", href: "/customers" },
  { label: "Blog",      href: "/blog" },
];

export function MarketingNav({ cta = "trial" }: MarketingNavProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-6">
        <Link href="/" className="text-sm font-semibold text-gray-900">
          ReviewBox
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-gray-500 sm:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <Link key={label} href={href} className="hover:text-gray-900 transition-colors">
              {label}
            </Link>
          ))}

          {cta === "signin" ? (
            <Link
              href="/sign-in"
              className="rounded-lg bg-[#0A84FF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0070e0] transition-colors"
            >
              Sign in
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="hover:text-gray-900 transition-colors">
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-lg bg-[#0A84FF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0070e0] transition-colors"
              >
                Start free trial
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
