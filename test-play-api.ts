import { fetchReviews } from "./src/services/google-play/publisher-api";
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function runTest() {
  console.log("🚀 Starting Google Play API Test...");

  // IMPORTANT: You MUST replace this with the actual package name of an app
  // that exists in your Google Play Console!
  const PACKAGE_NAME = "com.yourcompany.app"; 

  console.log(`Fetching reviews for package: ${PACKAGE_NAME}`);
  
  try {
    const reviews = await fetchReviews(PACKAGE_NAME);
    console.log(`\n✅ Success! Fetched ${reviews.length} reviews.`);
    
    if (reviews.length > 0) {
      console.log("\nHere is a preview of the latest review:");
      console.log(JSON.stringify(reviews[0], null, 2));
    }
  } catch (error: any) {
    console.error("\n❌ Test Failed!");
    console.error(error.message);
    if (error.response?.data) {
      console.error("Google API Details:", error.response.data);
    }
  }
}

runTest();
