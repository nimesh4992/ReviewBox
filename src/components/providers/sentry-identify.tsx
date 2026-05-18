"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useUser } from "@clerk/nextjs";

/**
 * Attaches the signed-in Clerk user to every Sentry event so we can
 * see which customer is affected when an error fires.
 */
export function SentryIdentify() {
  const { user, isSignedIn } = useUser();

  useEffect(() => {
    if (isSignedIn && user) {
      Sentry.setUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        username: user.fullName ?? undefined,
      });
    } else {
      Sentry.setUser(null);
    }
  }, [isSignedIn, user]);

  return null;
}
