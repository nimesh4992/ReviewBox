// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://d7251f0c095224d6bb311e9fe006c06c@o4511393630060544.ingest.us.sentry.io/4511393744748544",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Do NOT send personally identifiable information to the error tracker.
  // With this on, Sentry attaches request bodies, headers and IP addresses —
  // which on this product means third-party reviewers' names and review text
  // ending up in a diagnostics tool that our privacy disclosures describe as
  // receiving diagnostic data only. Errors still carry stack traces and the
  // Clerk user id we attach deliberately in SentryIdentify.
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
