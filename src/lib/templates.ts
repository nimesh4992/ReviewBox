const CRASH_TEMPLATE =
  "We're truly sorry you experienced a crash — that's never okay. Our engineering team has been notified and we're actively working on a fix. Please try force-quitting and reopening the app, or reinstall if the issue persists. We'll have a patch out as soon as possible. Thank you for your patience.\n\n— Support Team";

const BILLING_TEMPLATE =
  "We sincerely apologize for any billing confusion or unexpected charge. Please reach out to our support team directly so we can review your account and make it right as quickly as possible. We take billing issues very seriously and want to resolve this for you.\n\n— Support Team";

const THANK_YOU_TEMPLATE =
  "Thank you so much for the kind words — it truly means a lot to our whole team! We work hard to make the experience as smooth as possible, and feedback like yours keeps us motivated. If you ever have suggestions or run into anything, don't hesitate to reach out.\n\n— Support Team";

const GENERIC_TEMPLATE = null;

export function matchTemplate(review: {
  rating: number;
  body: string;
  tags: string[];
}): string | null {
  const bodyLower = review.body.toLowerCase();

  if (
    review.rating <= 2 &&
    (bodyLower.includes("crash") || review.tags.includes("crash"))
  ) {
    return CRASH_TEMPLATE;
  }

  if (
    review.rating <= 2 &&
    (bodyLower.includes("billing") ||
      bodyLower.includes("charge") ||
      review.tags.includes("billing"))
  ) {
    return BILLING_TEMPLATE;
  }

  if (review.rating >= 4) {
    return THANK_YOU_TEMPLATE;
  }

  return GENERIC_TEMPLATE;
}
