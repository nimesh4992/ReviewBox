import { google, androidpublisher_v3 } from "googleapis";
import { createPrivateKey } from "crypto";

// Ensure the environment variables are loaded
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;

/**
 * Normalise a Google service-account private key from whatever format
 * Vercel / .env stores it in so that Node 18+ / OpenSSL 3 can parse it.
 *
 * Fixes:
 *  1. Literal `\n` sequences stored in the env var (Vercel default)
 *  2. Surrounding double-quotes copied from the JSON file
 *  3. Windows CRLF line endings
 *
 * Throws a clear message if still unparseable so it surfaces in Sentry
 * rather than as the opaque `error:1E08010C:DECODER routines::unsupported`.
 */
function parsePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  // Strip surrounding quotes (common copy-paste artifact from the JSON file)
  let key = raw.trim().replace(/^["']|["']$/g, "");

  // Unescape \n sequences only when no real newlines are present
  if (!key.includes("\n")) {
    key = key.replace(/\\n/g, "\n");
  }

  // Normalise Windows CRLF → LF
  key = key.replace(/\r\n/g, "\n");

  // Validate via Node crypto — throws a clear error if still malformed
  try {
    createPrivateKey({ key, format: "pem" });
  } catch (err) {
    throw new Error(
      `GOOGLE_PRIVATE_KEY is malformed and cannot be parsed by OpenSSL. ` +
      `Check that the key in Vercel env vars is the full PEM block ` +
      `(including -----BEGIN PRIVATE KEY----- header/footer) with no ` +
      `surrounding quotes. Original error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return key;
}

const PRIVATE_KEY = parsePrivateKey(process.env.GOOGLE_PRIVATE_KEY);

/**
 * Creates an authenticated Google Play Publisher API client using the Service Account.
 */
function getPlayClient() {
  if (!CLIENT_EMAIL || !PRIVATE_KEY) {
    throw new Error("Google Play Service Account credentials are missing.");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: CLIENT_EMAIL,
      private_key: PRIVATE_KEY,
    },
    // The specific permission scope needed to read and reply to reviews
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });

  return google.androidpublisher({ version: "v3", auth });
}

/**
 * Fetches the latest reviews for a specific app package name.
 * @param packageName The unique bundle ID (e.g., com.example.app)
 */
export async function fetchReviews(packageName: string) {
  const play = getPlayClient();

  // Google Play's reviews.list returns only ~100 reviews per page and only the
  // last ~7 days regardless. Page through tokenPagination so a busy app with
  // >100 recent reviews isn't silently truncated. Cap pages defensively so a
  // malformed token can't loop forever or blow the serverless time budget.
  const MAX_PAGES = 10;
  const allReviews: androidpublisher_v3.Schema$Review[] = [];

  try {
    let token: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await Promise.race([
        play.reviews.list({
          packageName,
          maxResults: 100,
          ...(token ? { token } : {}),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Google Play fetchReviews timeout")), 15_000),
        ),
      ]);

      const batch = response.data.reviews ?? [];
      allReviews.push(...batch);

      token = response.data.tokenPagination?.nextPageToken ?? undefined;
      if (!token || batch.length === 0) break;
    }

    return allReviews;
  } catch (error) {
    console.error("Failed to fetch Google Play reviews:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Submits a reply to a specific customer review.
 * @param packageName The unique bundle ID (e.g., com.example.app)
 * @param reviewId The unique ID of the review from Google Play
 * @param replyText The text (AI-generated or human) to submit
 */
export async function submitReply(packageName: string, reviewId: string, replyText: string) {
  const play = getPlayClient();

  try {
    const response = await Promise.race([
      play.reviews.reply({
        packageName,
        reviewId,
        requestBody: { replyText },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Google Play submitReply timeout")), 15_000),
      ),
    ]);

    return response.data;
  } catch (error) {
    console.error("Failed to submit reply to Google Play:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
