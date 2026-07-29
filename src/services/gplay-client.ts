/**
 * gplay-client.ts
 *
 * Single typed wrapper around `google-play-scraper`.
 *
 * Why a wrapper: the library is CJS and needs `require` interop, and we call
 * it from three places (search, metadata, review bootstrap). Declaring the
 * shape three times drifted — this is the one definition.
 *
 * Why the library at all: Google rotates the Play Store markup constantly.
 * Hand-rolled regex over the search HTML broke in production (it silently
 * fell through to a path that returned raw package IDs as app names, showing
 * users a list of unrelated apps). The library tracks Google's internal
 * batchexecute payloads and is maintained; our regex is not.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mod = require("google-play-scraper") as { default?: GplayApi } & GplayApi;

export interface GplaySearchResult {
  appId:     string;
  title?:    string;
  developer?: string | { devId?: string };
  icon?:     string;
  score?:    number;
  url?:      string;
}

export interface GplayAppDetail {
  appId:      string;
  title?:     string;
  developer?: string | { devId?: string };
  icon?:      string;
  score?:     number;
  ratings?:   number;
  reviews?:   number;
}

export interface GplayReview {
  id:        string;
  userName:  string;
  date:      Date;
  score:     number;
  text:      string;
  replyDate: Date | null;
  replyText: string | null;
  version:   string | null;
}

export interface GplayApi {
  search(opts: {
    term: string;
    num?: number;
    lang?: string;
    country?: string;
    throttle?: number;
  }): Promise<GplaySearchResult[]>;

  app(opts: {
    appId: string;
    lang?: string;
    country?: string;
  }): Promise<GplayAppDetail>;

  reviews(opts: {
    appId: string;
    lang?: string;
    country?: string;
    sort?: number;
    num?: number;
  }): Promise<{ data: GplayReview[] }>;

  sort: { NEWEST: number; RATING: number; HELPFULNESS: number };
}

const gplay: GplayApi = (mod.default ?? mod) as GplayApi;

/** The library returns `developer` as a string on search, object on detail. */
export function developerName(
  value: string | { devId?: string } | undefined,
): string {
  if (!value) return "";
  return typeof value === "string" ? value : (value.devId ?? "");
}

export default gplay;
