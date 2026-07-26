import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  { key: "X-Frame-Options",           value: "DENY" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "X-DNS-Prefetch-Control",    value: "on" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // No strict CSP yet — Clerk and Stripe iframes break it
];

const nextConfig: NextConfig = {
  // TypeScript and ESLint are validated by CI (.github/workflows/ci.yml) on
  // every PR via dedicated tsc + lint jobs. Local `next build` runs them too.
  // No escape hatches here — if these fail, builds fail.
  async redirects() {
    return [
      {
        source: "/refund",
        destination: "/refund-policy",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "reviewbox",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",

  webpack: {
    automaticVercelMonitors: true,

    // Keep Sentry's edge wrapper off the middleware: it crashes when
    // SENTRY_DSN is missing, e.g. on Vercel preview deployments.
    //
    // Moved here from the top level, where it had silently become a no-op.
    // @sentry/nextjs deprecated the top-level spelling between the pinned
    // ^10.53.1 and the installed 10.68.0, and the SDK now reads only
    // `userSentryOptions.webpack?.autoInstrumentMiddleware ?? true`
    // (build/cjs/config/webpack.js) — it never looks at the old key.
    //
    // Hygiene, not a bug fix: building with and without this produced a
    // byte-identical middleware bundle (282,495 bytes, no wrapper helpers),
    // so the wrapper was not being applied either way on this project. This
    // restores the config's stated intent so it keeps holding if that
    // changes, and silences the deprecation warning.
    autoInstrumentMiddleware: false,

    treeshake: {
      removeDebugLogging: true,
    },
  },
});
