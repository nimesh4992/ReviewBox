/**
 * Language codes for `reply_templates.language`, which is **char(5)**.
 *
 * The UI used to send display names ("English", "Portuguese"), all of which
 * are longer than 5 characters. Postgres answered every insert with 22001
 * "value too long for type character(5)", the route turned that into a 500,
 * and the form said "Couldn't save — try again". Template creation had never
 * worked for anyone.
 *
 * Both template routes normalise through here, so nothing longer than 5
 * characters can reach the column again regardless of what a client sends.
 */

export const TEMPLATE_LANGUAGES = ["en", "es", "fr", "de", "pt", "it", "ja"] as const;
export type TemplateLanguage = (typeof TEMPLATE_LANGUAGES)[number];

const BY_NAME: Record<string, TemplateLanguage> = {
  english: "en", spanish: "es", french: "fr", german: "de",
  portuguese: "pt", italian: "it", japanese: "ja",
};

/**
 * Coerce any client-supplied language into a storable code.
 *
 * Accepts a code ("en"), a locale ("en-GB" → "en"), or a display name
 * ("English") — the last so that a client still sending the old values
 * degrades to a correct row instead of a 500. Anything unrecognised falls back
 * to "en" rather than failing the save; the language of a reply template is not
 * worth losing the template over.
 */
export function normalizeTemplateLanguage(value: unknown): TemplateLanguage {
  if (typeof value !== "string") return "en";
  const raw = value.trim().toLowerCase();
  if (!raw) return "en";

  const base = raw.split(/[-_]/)[0];
  if ((TEMPLATE_LANGUAGES as readonly string[]).includes(base)) {
    return base as TemplateLanguage;
  }
  return BY_NAME[raw] ?? "en";
}
