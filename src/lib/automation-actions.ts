/**
 * The automation action vocabulary — one definition, imported everywhere.
 *
 * This exists because the list was previously hand-copied into two route files
 * ("Allowlist — must stay in sync with AutomationAction union in
 * types/review.ts", said the comment above each copy) and, inevitably, they
 * drifted from the UI that offers the options. The rule builder advertised
 * "Auto-reply (AI)" as a selectable action while both the POST and PATCH
 * routes rejected it with a 400, so the feature was unreachable through the
 * product's own interface.
 *
 * Deliberately dependency-free so the client rule builder and the server
 * routes can share it without dragging Supabase/Groq into the browser bundle.
 */

import type { AutomationAction } from "@/types/review";

/** Every action the executor implements. */
export const AUTOMATION_ACTIONS = [
  "ai_reply",
  "auto_reply",
  "template_reply",
  "apply_tag",
  "escalate",
  "report_spam",
] as const satisfies readonly AutomationAction[];

/**
 * Actions a rule may currently be saved with — the allowlist the API enforces
 * and the set the rule builder offers. These are the same list on purpose: the
 * UI must never show an option the server will refuse.
 *
 * `auto_reply` is implemented in automation-executor.ts but is NOT here, and
 * must not be added until the per-workspace sync lock (backlog AS1) ships.
 * Without that lock, `syncWorkspace()` can run concurrently for one workspace
 * from four separate triggers, and two runs can classify the same new review
 * as new. For every other action that means duplicated internal writes; for
 * `auto_reply` it means generating two different AI replies and publishing
 * BOTH to the live Google Play / App Store listing for one review. Enabling
 * this before the lock turns an internal race into a customer-visible one.
 */
export const SELECTABLE_AUTOMATION_ACTIONS = [
  "ai_reply",
  "template_reply",
  "apply_tag",
  "escalate",
  "report_spam",
] as const satisfies readonly AutomationAction[];

export type SelectableAutomationAction = (typeof SELECTABLE_AUTOMATION_ACTIONS)[number];

export function isSelectableAutomationAction(
  value: unknown,
): value is SelectableAutomationAction {
  return (
    typeof value === "string" &&
    (SELECTABLE_AUTOMATION_ACTIONS as readonly string[]).includes(value)
  );
}

/** Human-readable list for the API's rejection message. */
export const SELECTABLE_ACTIONS_SENTENCE = SELECTABLE_AUTOMATION_ACTIONS.join(", ");
