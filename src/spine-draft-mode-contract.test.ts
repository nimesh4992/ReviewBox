/**
 * Draft Mode is the launch tier (docs/decisions.md D018) and steps 7 and 8 of
 * docs/SPINE.md — "the whole game", in that file's words. Both live in the
 * unconnected branch of the reply composer, which is the branch every customer
 * without store admin access sees, including the founder walking the spine.
 *
 * Neither step is reachable by the unit suite: this repo's Vitest setup is Node
 * env with pure functions only (no React Testing Library, see CLAUDE.md), and
 * both failures were in JSX props and a catch block. So this reads the
 * component's source, the way ci-contract / seo-indexing-contract /
 * marketing-claims-contract / load-error-contract already do for claims that
 * can silently drift.
 *
 * Both invariants below are regressions that shipped and were fixed, not
 * hypotheticals.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const COMPOSER = join(
  process.cwd(),
  "src/features/reviews/components/reply-composer-panel.tsx",
);
const REPLY_ROUTE = join(process.cwd(), "src/app/api/reviews/[id]/reply/route.ts");

const composer = readFileSync(COMPOSER, "utf8");
const replyRoute = readFileSync(REPLY_ROUTE, "utf8");

/**
 * The `disabled={...}` expression of the button wired to `handler`.
 *
 * Anchored on the onClick handler, not the label: label text also appears in
 * prose and in code comments ("Offering \"Copy reply\" as the hero…" sits
 * between the publish button and the copy button), and an earlier version of
 * this helper matched the comment and read the wrong button's props.
 */
function disabledExprForHandler(source: string, handler: string): string {
  const onClickAt = source.indexOf(`onClick={${handler}}`);
  expect(
    onClickAt,
    `No button wired to ${handler} in the composer. If it was renamed, ` +
      `update this test — do not delete it.`,
  ).toBeGreaterThan(-1);

  // From the onClick, read forward to the end of the opening tag.
  const tagEnd = source.indexOf(">", onClickAt);
  const tag = source.slice(onClickAt, tagEnd);
  const match = tag.match(/disabled=\{([^}]*)\}/);
  return match ? match[1] : "";
}

describe("SPINE step 8 — Mark as replied (Draft Mode)", () => {
  it("is NOT blocked by the store character limit", () => {
    const disabled = disabledExprForHandler(composer, "handleMarkReplied");

    // The limit describes what WE may push through the store's API. This
    // button pushes nothing — the user has already pasted the reply into the
    // store console themselves. Refusing to record something that already
    // happened cannot prevent it, and blocks SPINE step 8 outright for any
    // reply over 350 characters, which an AI draft reaches easily.
    expect(
      disabled,
      "Mark as replied is gated on overLimit again. A Google Play reply over " +
        "350 chars can then be copied and pasted (Copy reply is not gated) but " +
        "never recorded — SPINE step 8 fails for that review.",
    ).not.toMatch(/overLimit/);

    // Still guarded against the things that ARE its business.
    expect(disabled).toMatch(/text\.trim\(\)/);
    expect(disabled).toMatch(/isMarking/);
  });

  it("still shows the over-limit warning — the block is removed, not the signal", () => {
    // Removing the gate must not remove the information. The count and the red
    // warning stay; the user simply is not stopped by them.
    expect(composer).toMatch(/over the \{limit\}-char store limit/);
  });

  it("Publish reply IS still blocked by the limit — the API cannot exceed it", () => {
    const disabled = disabledExprForHandler(composer, "handleSend");
    expect(
      disabled,
      "Publish reply must stay limit-gated: this one really does submit to " +
        "the store API, which rejects over-limit replies.",
    ).toMatch(/overLimit/);
  });

  it("the server agrees: only `sent` is length-validated", () => {
    // The client gate was safe to drop only because the route's length check
    // sits inside the `status === "sent"` branch. If that check is ever hoisted
    // out, a manual_replied of any length starts 400ing and step 8 breaks from
    // the other side.
    const sentBranch = replyRoute.indexOf('status === "sent"');
    const lengthCheck = replyRoute.indexOf("REPLY_TOO_LONG");
    expect(sentBranch).toBeGreaterThan(-1);
    expect(lengthCheck).toBeGreaterThan(-1);
    expect(
      lengthCheck,
      "REPLY_TOO_LONG moved outside the `status === \"sent\"` branch. " +
        "manual_replied (Draft Mode) would now be rejected on length.",
    ).toBeGreaterThan(sentBranch);
  });
});

describe("SPINE step 7 — Copy reply (Draft Mode)", () => {
  it("reports a failed clipboard write instead of swallowing it", () => {
    // The catch used to set `copied` false and say nothing, so a blocked copy
    // looked identical to not having clicked. In Draft Mode the very next
    // action is pasting into Play Console — silently pasting whatever was on
    // the clipboard before, into a public reply, is what that silence hid.
    const copyFn = composer.slice(
      composer.indexOf("async function handleCopy"),
      composer.indexOf("async function handleMarkReplied"),
    );
    expect(copyFn.length).toBeGreaterThan(0);

    expect(
      copyFn,
      "handleCopy's catch no longer records the failure. A blocked copy is " +
        "silent again — SPINE step 7 fails with no signal to the user.",
    ).toMatch(/setCopyFailed\(true\)/);

    // And the fallback that makes it actionable: select the text so ⌘C works.
    expect(copyFn).toMatch(/\.select\(\)/);
  });

  it("renders the failure to the user, not just to state", () => {
    // Setting state nobody renders is the same silence with extra steps.
    expect(composer).toMatch(/copyFailed\s*&&/);
    expect(composer).toMatch(/Couldn&apos;t copy automatically/);
  });

  it("Copy reply is not limit-gated (the pair must stay coherent)", () => {
    const disabled = disabledExprForHandler(composer, "handleCopy");
    expect(
      disabled,
      "If Copy reply becomes limit-gated, revisit Mark as replied above — the " +
        "two must agree, or we hand out a reply we won't record.",
    ).not.toMatch(/overLimit/);
  });
});
