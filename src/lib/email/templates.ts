/**
 * The messages themselves.
 *
 * Each returns { subject, html, text } so senders only send. Keeping the copy
 * here rather than inside send-*.ts means it can be read end to end, reviewed
 * as writing, and rendered in the preview route without a mail provider.
 *
 * ── Rules this copy follows ──────────────────────────────────────────────────
 *
 * 1. The subject contains the reader's own data. "3 new reviews for Mumbai
 *    One" beats "Your daily ReviewBox digest" because only one of them is
 *    about them.
 * 2. No greeting line. "Hi Nimesh, welcome aboard!" costs the most valuable
 *    line in the message to say nothing.
 * 3. One button. A second call to action halves the first.
 * 4. The button names the action. "Open the inbox", not "Get started".
 * 5. No em dashes, no emoji, no exclamation marks. All three read as generated.
 * 6. Never claim what we cannot do. No "watch your rating climb".
 * 7. Numbers are always the reader's real numbers, and if there are none we
 *    say so plainly rather than inventing a milestone.
 */

import { renderEmail, renderEmailText, esc, EMAIL_APP_URL, type EmailOptions } from "./layout";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function build(subject: string, opts: EmailOptions): RenderedEmail {
  return { subject, html: renderEmail(opts), text: renderEmailText(opts) };
}

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

// ── 1. Welcome ────────────────────────────────────────────────────────────────

/**
 * One job: get them to their first published reply.
 *
 * Not a feature tour. Someone who has just signed up does not want to learn
 * about sentiment clustering, they want to see that this thing works on their
 * app. So the message is: here is what we already found in your store listing,
 * here is the button.
 */
export function welcomeEmail(params: {
  appName: string;
  reviewCount: number;
  needsReply: number;
  rating: number | null;
}): RenderedEmail {
  const { appName, reviewCount, needsReply, rating } = params;

  // A workspace whose first sync found nothing gets a different, honest
  // message. Congratulating someone on 0 reviews is how trust dies early.
  if (reviewCount === 0) {
    return build(`${appName} is connected`, {
      preheader: "We are still pulling your reviews from the store.",
      heading: `${esc(appName)} is connected.`,
      blocks: [
        {
          kind: "text",
          text: "We are pulling your reviews from the store now. The first batch usually lands within a few minutes, and after that we check once a day.",
        },
        { kind: "button", label: "Open the inbox", href: `${EMAIL_APP_URL}/inbox` },
        {
          kind: "note",
          text: "Nothing after an hour usually means the store lists your app in a country we have not checked yet. Reply to this email and we will sort it.",
        },
      ],
      footerNote: `You are getting this because you created a ReviewBox workspace for ${esc(appName)}.`,
    });
  }

  return build(
    // The subject is the finding, not the welcome.
    `${appName}: ${reviewCount} ${plural(reviewCount, "review")} ready to reply to`,
    {
      preheader: `${needsReply} of them have no reply yet.`,
      heading: `${esc(appName)} is connected. Here is what we found.`,
      blocks: [
        {
          kind: "stats",
          items: [
            { value: String(reviewCount), label: "reviews pulled in" },
            { value: String(needsReply), label: "with no reply yet" },
            ...(rating ? [{ value: rating.toFixed(1), label: "store rating" }] : []),
          ],
        },
        {
          kind: "text",
          text: "Every one has been read and tagged, so the urgent ones are already at the top. Open any review and there is a draft reply waiting in your voice. Edit it or publish it as is, and it goes straight to the store.",
        },
        { kind: "button", label: "Open the inbox", href: `${EMAIL_APP_URL}/inbox` },
        {
          kind: "note",
          text: "We sync once a day from here, and you can pull new reviews any time from Settings.",
        },
      ],
      footerNote: `You are getting this because you created a ReviewBox workspace for ${esc(appName)}.`,
    },
  );
}

// ── 2. Trial ending ───────────────────────────────────────────────────────────

/**
 * Three sends, and the first one is not a warning.
 *
 * Day 7 leads with what they have done, because someone who has published 12
 * replies has already got value and reminding them of it is worth more than
 * reminding them of a deadline. Only the later sends mention the date, and the
 * last one leads with the option to keep going rather than the loss.
 */
export function trialEndingEmail(params: {
  appName: string;
  daysLeft: number;
  repliesPublished: number;
  reviewsHandled: number;
  extendAvailable: boolean;
}): RenderedEmail {
  const { appName, daysLeft, repliesPublished, reviewsHandled, extendAvailable } = params;

  const usage: EmailOptions["blocks"][number] = {
    kind: "stats",
    items: [
      { value: String(repliesPublished), label: `${plural(repliesPublished, "reply", "replies")} published` },
      { value: String(reviewsHandled), label: "reviews read and tagged" },
    ],
  };

  // Mid-trial: a progress note, not a countdown.
  if (daysLeft > 3) {
    return build(
      repliesPublished > 0
        ? `You have published ${repliesPublished} ${plural(repliesPublished, "reply", "replies")} on ${appName}`
        : `${appName} has ${reviewsHandled} reviews waiting`,
      {
        preheader: `${daysLeft} days left on your trial.`,
        heading:
          repliesPublished > 0
            ? `${repliesPublished} ${plural(repliesPublished, "reply", "replies")} published so far.`
            : `${esc(appName)} has reviews waiting for you.`,
        blocks: [
          usage,
          {
            kind: "text",
            text:
              repliesPublished > 0
                ? "Those are live on the store under your developer name. Every review that arrives from here gets read, tagged and drafted before you open it."
                : "Each one is tagged and has a draft reply ready. Publishing one takes a single click, and it appears on the store within minutes.",
          },
          { kind: "button", label: "Open the inbox", href: `${EMAIL_APP_URL}/inbox` },
          { kind: "note", text: `Your trial runs for another ${daysLeft} days. No card on file, nothing charges automatically.` },
        ],
        footerNote: `Trial for ${esc(appName)}.`,
      },
    );
  }

  // Last few days: name the date, show what stops.
  if (daysLeft > 0) {
    return build(`Your ReviewBox trial ends in ${daysLeft} ${plural(daysLeft, "day")}`, {
      preheader: `${appName} keeps syncing, but one-click publishing stops.`,
      heading: `Your trial ends in ${daysLeft} ${plural(daysLeft, "day")}.`,
      blocks: [
        usage,
        {
          kind: "text",
          text: `When it ends, ${esc(appName)} keeps syncing and you keep every review and reply you already have. What changes is the volume: the free plan covers 25 published replies a month and 10 AI drafts.`,
        },
        { kind: "button", label: "See plans", href: `${EMAIL_APP_URL}/billing` },
        ...(extendAvailable
          ? [
              {
                kind: "note" as const,
                text: `Not ready to decide? You can <a href="${EMAIL_APP_URL}/billing" style="color:#0A84FF;text-decoration:none;font-weight:600;">add another 14 days</a> yourself, once, no questions.`,
              },
            ]
          : []),
      ],
      footerNote: `Trial for ${esc(appName)}.`,
    });
  }

  // Ended. Lead with the way back, not the loss.
  return build(`Your ReviewBox trial has ended`, {
    preheader: `${appName} is still syncing. Your replies are still there.`,
    heading: "Your trial has ended.",
    blocks: [
      usage,
      {
        kind: "text",
        text: `Nothing has been deleted. ${esc(appName)} still syncs daily and every reply you published is still on the store. You are on the free plan now, which covers 25 published replies a month.`,
      },
      { kind: "button", label: "See plans", href: `${EMAIL_APP_URL}/billing` },
      ...(extendAvailable
        ? [
            {
              kind: "note" as const,
              text: `If you need longer to decide, you can <a href="${EMAIL_APP_URL}/billing" style="color:#0A84FF;text-decoration:none;font-weight:600;">give yourself another 14 days</a>.`,
            },
          ]
        : []),
    ],
    footerNote: `Trial for ${esc(appName)}.`,
  });
}

// ── 3. Invite ─────────────────────────────────────────────────────────────────

/**
 * The recipient may never have heard of us, so the subject leads with the
 * person they know and the workspace they recognise. "You have been invited to
 * ReviewBox" gets deleted; "Nimesh added you to AT WORK" gets opened.
 */
export function inviteEmail(params: {
  inviterName: string;
  workspaceName: string;
  appName: string | null;
  inviteUrl: string;
  expiresInDays: number;
}): RenderedEmail {
  const { inviterName, workspaceName, appName, inviteUrl, expiresInDays } = params;

  return build(`${inviterName} added you to ${workspaceName} on ReviewBox`, {
    preheader: appName
      ? `You will be able to reply to ${appName} reviews.`
      : "One click to join the workspace.",
    heading: `${esc(inviterName)} added you to ${esc(workspaceName)}.`,
    blocks: [
      {
        kind: "text",
        text: appName
          ? `ReviewBox is where the team reads and answers ${esc(appName)} reviews from the App Store and Google Play. Replies you publish go straight to the store.`
          : "ReviewBox is where the team reads and answers App Store and Google Play reviews. Replies you publish go straight to the store.",
      },
      { kind: "button", label: "Join the workspace", href: inviteUrl },
      {
        kind: "note",
        text: `This link works for ${expiresInDays} days and only for this email address. If you were not expecting it, you can ignore it.`,
      },
    ],
  });
}

// ── 4. Daily digest ───────────────────────────────────────────────────────────

/**
 * The retention product, and the one that must always arrive.
 *
 * On a quiet day we send anyway and show the most recent review instead. A
 * daily email that sometimes does not turn up teaches people to stop looking
 * for it, and once they stop looking they stop coming back. Silence is the
 * expensive option.
 */
export function dailyDigestEmail(params: {
  appName: string;
  newReviews: number;
  needsReply: number;
  rating: number | null;
  ratingDelta: number | null;
  reviews: Array<{ id: string; author: string; rating: number; body: string; meta?: string }>;
  quietDay: boolean;
  unsubscribeUrl: string;
}): RenderedEmail {
  const { appName, newReviews, needsReply, rating, ratingDelta, reviews, quietDay, unsubscribeUrl } =
    params;

  const cards = reviews.slice(0, 3).map((r) => ({
    kind: "review" as const,
    author: r.author || "Anonymous",
    rating: r.rating,
    body: r.body.length > 220 ? `${r.body.slice(0, 220).trimEnd()}...` : r.body,
    meta: r.meta,
    href: `${EMAIL_APP_URL}/inbox?review=${encodeURIComponent(r.id)}`,
  }));

  const statBlocks = [
    {
      kind: "stats" as const,
      items: [
        { value: String(newReviews), label: "new yesterday" },
        { value: String(needsReply), label: "awaiting a reply" },
        ...(rating
          ? [
              {
                value: rating.toFixed(1),
                label:
                  ratingDelta && Math.abs(ratingDelta) >= 0.05
                    ? `rating (${ratingDelta > 0 ? "+" : ""}${ratingDelta.toFixed(2)})`
                    : "store rating",
              },
            ]
          : []),
      ],
    },
  ];

  if (quietDay) {
    return build(`${appName}: a quiet day`, {
      preheader:
        needsReply > 0
          ? `No new reviews, but ${needsReply} still have no reply.`
          : "No new reviews, and nothing waiting.",
      heading: `No new reviews for ${esc(appName)} yesterday.`,
      blocks: [
        ...statBlocks,
        {
          kind: "text",
          text:
            needsReply > 0
              ? `Nothing new came in. ${needsReply} ${plural(needsReply, "review")} from earlier ${plural(needsReply, "is", "are")} still unanswered.`
              : "Nothing new came in, and everything is answered. Here is the most recent one, in case you want to look back.",
          muted: true,
        },
        ...cards,
        {
          kind: "button",
          label: needsReply > 0 ? "Clear the backlog" : "Open the inbox",
          href: `${EMAIL_APP_URL}/inbox`,
        },
      ],
      footerNote: `Daily summary for ${esc(appName)}.`,
      unsubscribeUrl,
    });
  }

  return build(
    needsReply > 0
      ? `${appName}: ${newReviews} new, ${needsReply} need a reply`
      : `${appName}: ${newReviews} new ${plural(newReviews, "review")}`,
    {
      preheader:
        reviews[0] != null
          ? `"${reviews[0].body.slice(0, 90)}${reviews[0].body.length > 90 ? "..." : ""}"`
          : `${needsReply} awaiting a reply.`,
      heading: `${newReviews} new ${plural(newReviews, "review")} for ${esc(appName)}.`,
      blocks: [
        ...statBlocks,
        ...cards,
        ...(reviews.length > 3
          ? [
              {
                kind: "text" as const,
                text: `And ${reviews.length - 3} more.`,
                muted: true,
              },
            ]
          : []),
        { kind: "button", label: "Reply in ReviewBox", href: `${EMAIL_APP_URL}/inbox` },
      ],
      footerNote: `Daily summary for ${esc(appName)}.`,
      unsubscribeUrl,
    },
  );
}

// ── 5. Monthly digest ─────────────────────────────────────────────────────────

/**
 * The email that has to justify the invoice.
 *
 * Where the daily digest is operational, this one is retrospective: what
 * changed, what people kept saying, and one thing worth doing about it. The
 * single recommendation at the end is the part worth reading, so it is the
 * part that gets the button.
 */
export function monthlyDigestEmail(params: {
  appName: string;
  monthLabel: string;
  rating: number | null;
  ratingDelta: number | null;
  totalReviews: number;
  repliesPublished: number;
  replyRate: number;
  topThemes: Array<{ label: string; count: number; sentiment: "positive" | "negative" | "mixed" }>;
  unsubscribeUrl: string;
}): RenderedEmail {
  const {
    appName,
    monthLabel,
    rating,
    ratingDelta,
    totalReviews,
    repliesPublished,
    replyRate,
    topThemes,
    unsubscribeUrl,
  } = params;

  const worst = topThemes.find((t) => t.sentiment === "negative");
  const direction =
    ratingDelta == null || Math.abs(ratingDelta) < 0.05
      ? "held steady"
      : ratingDelta > 0
        ? `rose ${ratingDelta.toFixed(2)}`
        : `fell ${Math.abs(ratingDelta).toFixed(2)}`;

  return build(
    `${appName} in ${monthLabel}: ${rating ? `${rating.toFixed(1)} stars, ` : ""}${totalReviews} ${plural(totalReviews, "review")}`,
    {
      preheader: `${replyRate}% replied. ${worst ? `Most complaints were about ${worst.label}.` : ""}`,
      heading: `${esc(appName)} in ${esc(monthLabel)}.`,
      blocks: [
        {
          kind: "stats",
          items: [
            ...(rating ? [{ value: rating.toFixed(1), label: `stars, ${direction}` }] : []),
            { value: String(totalReviews), label: "reviews" },
            { value: String(repliesPublished), label: "replies published" },
            { value: `${replyRate}%`, label: "replied to" },
          ],
        },
        { kind: "divider" },
        ...(topThemes.length
          ? [
              {
                kind: "text" as const,
                text: "<strong>What people wrote about</strong>",
              },
              {
                kind: "list" as const,
                items: topThemes
                  .slice(0, 5)
                  .map(
                    (t) =>
                      `${esc(t.label)} in ${t.count} ${plural(t.count, "review")}${
                        t.sentiment === "negative" ? " (mostly complaints)" : t.sentiment === "positive" ? " (mostly praise)" : ""
                      }`,
                  ),
              },
            ]
          : []),
        ...(worst
          ? [
              {
                kind: "note" as const,
                text: `<strong>Worth a look:</strong> ${esc(worst.label)} came up in ${worst.count} ${plural(worst.count, "review")} and most were unhappy. Filtering the inbox by that tag shows them together.`,
              },
            ]
          : []),
        { kind: "button", label: "Open the full report", href: `${EMAIL_APP_URL}/reports` },
      ],
      footerNote: `Monthly summary for ${esc(appName)}.`,
      unsubscribeUrl,
    },
  );
}
