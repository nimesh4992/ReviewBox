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

  // Disable middleware auto-instrumentation — Sentry's edge wrapper crashes
  // when SENTRY_DSN is missing (e.g. Vercel preview deployments).
  // Middleware errors are still caught by the server-side Sentry init.
  autoInstrumentMiddleware: false,

  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
