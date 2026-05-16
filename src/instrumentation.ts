import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      enableLogs: true,
      enabled: process.env.NODE_ENV === "production",
      debug: false,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      enableLogs: true,
      enabled: process.env.NODE_ENV === "production",
      debug: false,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
