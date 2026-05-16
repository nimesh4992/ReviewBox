import Link from "next/link";

const FOOTER_LINKS = [
  {
    group: "Product",
    links: [
      { label: "Pricing",    href: "/pricing" },
      { label: "Compare",    href: "/compare" },
      { label: "Customers",  href: "/customers" },
      { label: "Changelog",  href: "/changelog" },
    ],
  },
  {
    group: "Company",
    links: [
      { label: "About",    href: "/about" },
      { label: "Blog",     href: "/blog" },
      { label: "Careers",  href: "/careers" },
      { label: "Contact",  href: "/contact" },
    ],
  },
  {
    group: "Resources",
    links: [
      { label: "Help Center", href: "/help" },
      { label: "FAQ",         href: "/faq" },
      { label: "Status",      href: "/status" },
    ],
  },
  {
    group: "Legal",
    links: [
      { label: "Terms",          href: "/terms" },
      { label: "Privacy",        href: "/privacy" },
      { label: "DPA",            href: "/dpa" },
      { label: "Refund Policy",  href: "/refund-policy" },
      { label: "Acceptable Use", href: "/acceptable-use" },
      { label: "Cookies",        href: "/cookies" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-screen-xl px-6 py-12">
        {/* Top — logo + tagline */}
        <div className="mb-10 flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[#0A84FF] text-[11px] font-bold text-white">
            R
          </span>
          <span className="text-sm font-semibold text-gray-900">ReviewBox</span>
          <span className="text-xs text-gray-400">— Review Intelligence</span>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 mb-12">
          {FOOTER_LINKS.map(({ group, links }) => (
            <div key={group}>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                {group}
              </p>
              <ul className="space-y-2">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-100 pt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-400">© 2026 ReviewBox, Inc. All rights reserved.</p>
          <p className="text-xs text-gray-400">
            <a href="mailto:hello@tryreviewbox.com" className="hover:text-gray-600 transition-colors">
              hello@tryreviewbox.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
