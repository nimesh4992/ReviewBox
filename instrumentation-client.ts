import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,

  // Record user sessions only when an error occurs
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.01,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Silence in development — errors still appear in the console
  enabled: process.env.NODE_ENV === "production",
  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
