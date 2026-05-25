import { google } from "googleapis";

// Ensure the environment variables are loaded
// In production, these will either come from Vercel ENV or be fetched securely from Supabase
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
// Private keys in .env often have literal "\n" strings that need to be parsed back to actual newlines
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

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
