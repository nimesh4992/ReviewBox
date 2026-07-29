import { after } from "next/server";

/**
 * Run a side effect AFTER the response is sent, without it being killed when
 * Vercel freezes the lambda — the fate of every bare fire-and-forget fetch.
 *
 * Falls back to immediate fire-and-forget when called outside a Next request
 * scope (unit tests invoking route handlers directly), where after() throws.
 */
export function defer(fn: () => Promise<unknown>): void {
  try {
    after(fn);
  } catch {
    void fn().catch(() => undefined);
  }
}
