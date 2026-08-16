/**
 * One layout, every email.
 *
 * Before this, each sender hand-built its own table: different header colours,
 * different type scales, different buttons, an indigo brand mark that appears
 * nowhere in the product. Five emails looked like five different companies.
 *
 * ── Why the markup looks like 2005 ───────────────────────────────────────────
 * Outlook on Windows renders mail with Word's engine. No flexbox, no grid, no
 * `max-width` on divs, no border-radius on containers. Gmail strips <style>
 * blocks when a message is forwarded and clips the whole message at 102KB.
 * So: nested tables, inline styles, and no class names. This is not
 * carelessness, it is the format.
 *
 * ── Design ───────────────────────────────────────────────────────────────────
 * The visual language is the app's: white surface, one blue for the one
 * action, the same three-step text ramp. Deliberately absent:
 *
 *   - A tall dark brand banner. It is the most valuable space in the message
 *     and spending it on our own logo says nothing. The wordmark is small and
 *     the first real line is the fact the reader came for.
 *   - Gradients, emoji headings, drop shadows. They read as marketing, and
 *     marketing is what people archive unread.
 *   - More than one button. A second call to action halves the first.
 *
 * ── Copy rules, enforced by the block API ────────────────────────────────────
 * `heading` is a fact, not a greeting. `stats` shows the reader's own numbers,
 * because their data is the only thing in the message they cannot get
 * elsewhere. There is one `button` and its label names the action ("Open the
 * inbox"), never "Learn more".
 */

export type EmailBlock =
  | { kind: "text"; text: string; muted?: boolean }
  /** App icon + name. Makes the message theirs in the first 40px. */
  | { kind: "appHeader"; appName: string; iconUrl: string | null; platform: string }
  /** The one number that matters, with its movement coloured. */
  | {
      kind: "heroStat";
      value: string;
      label: string;
      delta?: { value: string; direction: "up" | "down" | "flat" };
      tone?: "neutral" | "good" | "bad";
    }
  /** Star distribution as a stacked bar. Five numbers say more than an average. */
  | { kind: "ratingBars"; distribution: [number, number, number, number, number] }
  | { kind: "button"; label: string; href: string }
  | { kind: "stats"; items: Array<{ value: string; label: string }> }
  | {
      kind: "review";
      author: string;
      rating: number;
      body: string;
      meta?: string;
      href?: string;
    }
  | { kind: "divider" }
  | { kind: "note"; text: string }
  | { kind: "list"; items: string[] };

export interface EmailOptions {
  /** The hidden line inboxes show after the subject. Never leave this out. */
  preheader: string;
  /** First visible line. A fact about the reader, not a welcome. */
  heading: string;
  blocks: EmailBlock[];
  /** Optional line above the unsubscribe row, e.g. which app this is about. */
  footerNote?: string;
  /** Set for digests and nudges; omitted for transactional mail. */
  unsubscribeUrl?: string;
}

// ── Tokens ────────────────────────────────────────────────────────────────────
// Hardcoded rather than referencing CSS variables: mail clients have no
// custom-property support worth relying on, and these must match the app's
// --rb-* values by eye.
const C = {
  canvas: "#F5F5F7",
  surface: "#FFFFFF",
  border: "#E5E5E7",
  fg1: "#1D1D1F",
  fg2: "#48484D",
  fg3: "#86868B",
  blue: "#0A84FF",
  blueDark: "#0060DF",
  amber: "#C97A00",
  star: "#F5A623",
  good: "#1F8A5B",
  goodSoft: "#E8F6EF",
  bad: "#D14343",
  badSoft: "#FDEDED",
  tint: "#F0F6FF",
  // Star-rating ramp, 1 to 5. Red through amber to green, so a distribution
  // bar can be read at a glance without a legend.
  ramp: ["#D14343", "#E8833A", "#E5B02E", "#8CBF3F", "#1F8A5B"],
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.tryreviewbox.com";

/** Escape anything that reaches the HTML. Review text is user content. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stars(rating: number): string {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    `<span style="color:${C.star};font-size:14px;letter-spacing:1px;">${"★".repeat(n)}</span>` +
    `<span style="color:#D2D2D7;font-size:14px;letter-spacing:1px;">${"★".repeat(5 - n)}</span>`
  );
}

// ── Block rendering ───────────────────────────────────────────────────────────

function renderBlock(b: EmailBlock): string {
  switch (b.kind) {
    case "appHeader": {
      // Images are blocked by default in a lot of clients, so the icon is
      // decoration and the name beside it carries the meaning. Never put
      // information only in an image.
      const icon = b.iconUrl
        ? `<img src="${b.iconUrl}" width="40" height="40" alt="" style="display:block;width:40px;height:40px;border-radius:9px;border:1px solid ${C.border};" />`
        : "";
      return `<tr><td style="padding:0 0 18px;">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          ${icon ? `<td valign="middle" style="padding-right:12px;">${icon}</td>` : ""}
          <td valign="middle">
            <div style="font-family:${FONT};font-size:15px;font-weight:700;color:${C.fg1};line-height:1.3;">${esc(b.appName)}</div>
            <div style="font-family:${FONT};font-size:12px;color:${C.fg3};padding-top:1px;">${esc(b.platform)}</div>
          </td>
        </tr></table>
      </td></tr>`;
    }

    case "heroStat": {
      // One number, given room. A rating that fell should look like it fell,
      // so the delta is coloured rather than left as grey text.
      const bg = b.tone === "good" ? C.goodSoft : b.tone === "bad" ? C.badSoft : C.tint;
      const deltaColor =
        b.delta?.direction === "up" ? C.good : b.delta?.direction === "down" ? C.bad : C.fg3;
      const arrow =
        b.delta?.direction === "up" ? "&#9650;" : b.delta?.direction === "down" ? "&#9660;" : "";
      return `<tr><td style="padding:0 0 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border-radius:12px;">
          <tr><td style="padding:18px 20px;">
            <table cellpadding="0" cellspacing="0" border="0"><tr>
              <td valign="bottom" style="font-family:${FONT};font-size:38px;line-height:1;font-weight:700;color:${C.fg1};letter-spacing:-1px;">${b.value}</td>
              ${
                b.delta
                  ? `<td valign="bottom" style="padding:0 0 4px 10px;font-family:${FONT};font-size:14px;font-weight:700;color:${deltaColor};">${arrow} ${b.delta.value}</td>`
                  : ""
              }
            </tr></table>
            <div style="font-family:${FONT};font-size:13px;color:${C.fg2};padding-top:6px;">${b.label}</div>
          </td></tr>
        </table>
      </td></tr>`;
    }

    case "ratingBars": {
      const total = b.distribution.reduce((a, n) => a + n, 0);
      if (total === 0) return "";
      // One stacked bar, 1 star to 5, plus the counts underneath. Five numbers
      // tell you something an average hides: whether 3.1 means "everyone is
      // lukewarm" or "half love it and half are furious".
      const segments = b.distribution
        .map((n, i) => {
          if (n === 0) return "";
          const pct = Math.max(2, Math.round((n / total) * 100));
          return `<td width="${pct}%" style="background:${C.ramp[i]};height:10px;line-height:10px;font-size:0;">&nbsp;</td>`;
        })
        .join("");
      const legend = b.distribution
        .map(
          (n, i) =>
            `<td align="left" style="font-family:${FONT};font-size:11px;color:${C.fg3};padding-top:8px;">
               <span style="color:${C.ramp[i]};font-size:12px;">&#9632;</span>&nbsp;${i + 1}&#9733; ${n}
             </td>`,
        )
        .join("");
      return `<tr><td style="padding:0 0 22px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:6px;overflow:hidden;">
          <tr>${segments}</tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${legend}</tr></table>
      </td></tr>`;
    }

    case "text":
      return `<tr><td style="padding:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${
        b.muted ? C.fg3 : C.fg2
      };">${b.text}</td></tr>`;

    case "list":
      return `<tr><td style="padding:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.fg2};">
        ${b.items
          .map(
            (i) =>
              `<div style="padding:0 0 8px;"><span style="color:${C.fg3};">•</span>&nbsp;&nbsp;${i}</div>`,
          )
          .join("")}
      </td></tr>`;

    case "button":
      // Padded anchor inside a table cell. A bare styled <a> loses its
      // background in Outlook; the cell carries the colour so the button
      // survives even where the anchor styling is dropped.
      return `<tr><td style="padding:8px 0 24px;">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td align="center" bgcolor="${C.blue}" style="border-radius:8px;">
            <a href="${b.href}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">${b.label}</a>
          </td>
        </tr></table>
      </td></tr>`;

    case "stats":
      // One row of the reader's own numbers. Their data is the only thing in
      // the message they can't get anywhere else, so it sits high and big.
      return `<tr><td style="padding:0 0 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          ${b.items
            .map(
              (s) => `<td align="left" valign="top" style="padding:0 16px 0 0;">
                <div style="font-family:${FONT};font-size:26px;font-weight:700;color:${C.fg1};line-height:1.2;">${s.value}</div>
                <div style="font-family:${FONT};font-size:12px;color:${C.fg3};padding-top:2px;">${s.label}</div>
              </td>`,
            )
            .join("")}
        </tr></table>
      </td></tr>`;

    case "review": {
      // A 1-star crisis and a 4-star compliment rendered identically before
      // this. The accent bar down the left is the same signal the inbox uses,
      // so the shape of the day is readable without reading a word.
      const accent = b.rating <= 2 ? C.bad : b.rating === 3 ? C.ramp[2] : C.good;
      return `<tr><td style="padding:0 0 12px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.border};border-radius:10px;">
          <tr>
          <td width="4" style="background:${accent};width:4px;font-size:0;line-height:0;border-radius:10px 0 0 10px;">&nbsp;</td>
          <td style="padding:14px 16px;">
            <div style="font-family:${FONT};font-size:13px;color:${C.fg3};padding-bottom:6px;">
              ${stars(b.rating)}&nbsp;&nbsp;<span style="color:${C.fg2};font-weight:600;">${esc(b.author)}</span>${
                b.meta ? `&nbsp;&nbsp;·&nbsp;&nbsp;${esc(b.meta)}` : ""
              }
            </div>
            <div style="font-family:${FONT};font-size:14px;line-height:1.55;color:${C.fg1};">${esc(b.body)}</div>
            ${
              b.href
                ? `<div style="padding-top:10px;"><a href="${b.href}" style="font-family:${FONT};font-size:13px;font-weight:600;color:${C.blue};text-decoration:none;">Reply to this &rsaquo;</a></div>`
                : ""
            }
          </td></tr>
        </table>
      </td></tr>`;
    }

    case "divider":
      return `<tr><td style="padding:8px 0 24px;"><div style="height:1px;background:${C.border};line-height:1px;font-size:0;">&nbsp;</div></td></tr>`;

    case "note":
      return `<tr><td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.canvas};border-radius:8px;">
          <tr><td style="padding:12px 14px;font-family:${FONT};font-size:13px;line-height:1.55;color:${C.fg2};">${b.text}</td></tr>
        </table>
      </td></tr>`;
  }
}

// ── Document ──────────────────────────────────────────────────────────────────

export function renderEmail(opts: EmailOptions): string {
  const { preheader, heading, blocks, footerNote, unsubscribeUrl } = opts;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<!-- Tell clients this design is light-only. Without it, Gmail and Apple Mail
     force-invert, which turns the blue button muddy and drops the borders. -->
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.canvas};-webkit-font-smoothing:antialiased;">

<!-- Preheader: the grey line inboxes show after the subject. Left empty, Gmail
     pulls the first body text instead, which is usually the least useful
     sentence in the message. The zero-width padding after it stops any of the
     real copy leaking into the preview. -->
<div style="display:none;font-size:1px;color:${C.canvas};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${esc(preheader)}
  ${"&#847;&zwnj;&nbsp;".repeat(60)}
</div>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.canvas};">
<tr><td align="center" style="padding:32px 12px;">

  <table width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

    <!-- Wordmark. Small on purpose: the top of the message is the most
         valuable space in it, and our logo is not why anyone opened this. -->
    <tr><td style="padding:0 4px 14px;">
      <span style="font-family:${FONT};font-size:14px;font-weight:700;color:${C.fg1};letter-spacing:-0.2px;">ReviewBox</span>
    </td></tr>

    <tr><td style="background:${C.surface};border:1px solid ${C.border};border-radius:14px;padding:28px 28px 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${/* The app identity sits ABOVE the heading, so the heading never has
             to repeat the app name to say whose reviews these are. "Mumbai
             One / Google Play" then "3 new reviews yesterday" reads as one
             thought; the other order says the name twice. */ ""}
        ${blocks.filter((b) => b.kind === "appHeader").map(renderBlock).join("")}
        <tr><td style="padding:0 0 14px;font-family:${FONT};font-size:21px;line-height:1.3;font-weight:700;color:${C.fg1};letter-spacing:-0.3px;">${heading}</td></tr>
        ${blocks.filter((b) => b.kind !== "appHeader").map(renderBlock).join("\n")}
      </table>
    </td></tr>

    <tr><td style="padding:18px 6px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.fg3};">
      ${footerNote ? `${footerNote}<br />` : ""}
      <a href="${APP_URL}/dashboard" style="color:${C.fg3};text-decoration:underline;">Open ReviewBox</a>
      &nbsp;·&nbsp;
      <a href="${APP_URL}/settings" style="color:${C.fg3};text-decoration:underline;">Email settings</a>
      ${
        unsubscribeUrl
          ? `&nbsp;·&nbsp;<a href="${unsubscribeUrl}" style="color:${C.fg3};text-decoration:underline;">Unsubscribe</a>`
          : ""
      }
    </td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;
}

/**
 * Plain-text twin of the same blocks.
 *
 * Not optional. A text/html message with no text/plain alternative is one of
 * the strongest spam signals there is, and these emails have to reach an inbox
 * to be worth designing.
 */
export function renderEmailText(opts: EmailOptions): string {
  const lines: string[] = [opts.heading, ""];

  for (const b of opts.blocks) {
    switch (b.kind) {
      case "text":
        lines.push(stripTags(b.text), "");
        break;
      case "list":
        lines.push(...b.items.map((i) => `- ${stripTags(i)}`), "");
        break;
      case "button":
        lines.push(`${b.label}: ${b.href}`, "");
        break;
      case "stats":
        lines.push(b.items.map((s) => `${s.value} ${s.label}`).join("   |   "), "");
        break;
      case "appHeader":
        lines.push(`${b.appName} (${b.platform})`, "");
        break;
      case "heroStat":
        lines.push(`${b.value}${b.delta ? ` (${b.delta.value})` : ""} ${b.label}`, "");
        break;
      case "ratingBars":
        lines.push(
          b.distribution.map((n, i) => `${i + 1} star: ${n}`).join("   |   "),
          "",
        );
        break;
      case "review":
        lines.push(
          `${"*".repeat(Math.round(b.rating))} ${b.author}${b.meta ? ` (${b.meta})` : ""}`,
          b.body,
          b.href ? `Reply: ${b.href}` : "",
          "",
        );
        break;
      case "note":
        lines.push(stripTags(b.text), "");
        break;
      case "divider":
        lines.push("---", "");
        break;
    }
  }

  lines.push(`Open ReviewBox: ${APP_URL}/dashboard`);
  if (opts.unsubscribeUrl) lines.push(`Unsubscribe: ${opts.unsubscribeUrl}`);
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

function stripTags(html: string): string {
  return html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

export { APP_URL as EMAIL_APP_URL, C as EMAIL_COLORS };
