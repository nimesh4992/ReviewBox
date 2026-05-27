import { google } from "googleapis";
import { createPrivateKey } from "crypto";

// Ensure the environment variables are loaded
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;

/**
 * Normalise a Google service-account private key from whatever format
 * Vercel / .env stores it in so that Node 18+ / OpenSSL 3 can parse it.
 *
 * Common problems this fixes:
 *  1. Literal `\n` sequences stored in the env var (Vercel default)
 *  2. Surrounding double-quotes copied from the JSON file
 *  3. Windows CRLF line endings
 *
 * Throws a clear message if the key is still unparseable after normalisation
 * so the error surfaces in Sentry rather than as a cryptic OpenSSL code.
 */
function parsePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  // Strip surrounding quotes that are sometimes included in copy-paste
  let key = raw.trim().replace(/^["']|["']$/g, "");

  // If no real newlines exist, unescape the literal \n sequences
  if (!key.includes("\n")) {
    key = key.replace(/\\n/g, "\n");
  }

  // Normalise Windows CRLF → LF
  key = key.replace(/\r\n/g, "\n");

  // Validate: attempt to parse through Node crypto.  Throws a clear error
  // (rather than `error:1E08010C:DECODER routines::unsupported`) if the
  // key is still malformed after the transformations above.
  try {
    createPrivateKey({ key, format: "pem" });
  } catch (err) {
    throw new Error(
      `GOOGLE_PRIVATE_KEY is malformed and cannot be parsed by OpenSSL. ` +
      `Check that the key in Vercel env vars is the full PEM block (including ` +
      `-----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----) with no ` +
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

  try {
    const response = await Promise.race([
      play.reviews.list({ packageName, maxResults: 100 }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Google Play fetchReviews timeout")), 15_000),
      ),
    ]);

    return response.data.reviews || [];
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
