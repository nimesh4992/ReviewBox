/**
 * api-error-message.ts
 *
 * Turns any API error payload into a string safe to render.
 *
 * Why this exists: our API returns `{ error: { code, message } }`
 * (`apiError()` in api-response.ts), but several components typed the parsed
 * body as `{ error?: string }` and did `setError(body.error)`. TypeScript
 * accepted it — the annotation is a *cast* over `res.json()`, which is `any`,
 * so the compiler was told a lie rather than catching one. React then tried
 * to render an object and threw **error #31 ("Objects are not valid as a
 * React child")**, replacing the whole page with "Something went wrong".
 *
 * The user impact was worse than a crash: it hid the actual error. Adding an
 * app failed for some real reason, and instead of showing that reason the
 * settings page died.
 *
 * Client-safe on purpose — no Sentry/NextResponse imports, so components can
 * use it without pulling server code into the bundle.
 */

/**
 * @param body     Parsed JSON body of a failed response (any shape).
 * @param fallback Shown when the body carries nothing useful.
 */
export function apiErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "string" && body.trim()) return body;
  if (!body || typeof body !== "object") return fallback;

  const b = body as Record<string, unknown>;

  // Canonical envelope: { error: { code, message } }
  const err = b.error;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string" && e.message.trim()) return e.message;
    // No message but a code is still better than a generic fallback.
    if (typeof e.code === "string" && e.code.trim()) return humanizeCode(e.code);
  }

  // Legacy / ad-hoc shapes seen across routes.
  if (typeof err === "string" && err.trim()) return humanizeCode(err);
  if (typeof b.message === "string" && b.message.trim()) return b.message;
  if (typeof b.detail === "string" && b.detail.trim()) return b.detail;

  return fallback;
}

/**
 * Some routes return only a SCREAMING_SNAKE code. Render it as words rather
 * than shouting an identifier at a non-technical user.
 */
function humanizeCode(code: string): string {
  if (!/^[A-Z0-9_]+$/.test(code)) return code;
  const words = code.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
