import type { MetadataRoute } from "next";
import { marketingUrl } from "@/lib/site-urls";

// The PUBLIC origin, not the app's. Canonical URLs and sitemap entries must
// name the marketing domain even when the app sits on a subdomain — see
// lib/site-urls.ts.
const BASE_URL = marketingUrl();

function url(path: string, priority: number, freq: MetadataRoute.Sitemap[number]["changeFrequency"]) {
  return { url: `${BASE_URL}${path}`, lastModified: new Date(), changeFrequency: freq, priority };
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // Core marketing
    url("/",          1.0, "weekly"),
    url("/pricing",   0.9, "weekly"),

    // Company
    url("/about",     0.7, "monthly"),
    url("/blog",      0.8, "weekly"),
    url("/changelog", 0.7, "weekly"),
    url("/contact",   0.6, "monthly"),

    // Help & FAQ
    url("/faq",                            0.7, "monthly"),
    url("/help",                           0.7, "monthly"),
    url("/help/connect-google-play",       0.6, "monthly"),
    url("/help/connect-app-store",         0.6, "monthly"),
    url("/help/ai-replies",                0.6, "monthly"),
    url("/help/review-history",            0.6, "monthly"),
    url("/help/automation",                0.6, "monthly"),

    // Blog
    url("/blog/ai-cost-reduction",         0.7, "monthly"),

    // Case studies

    // Auth
    url("/sign-up", 0.7, "yearly"),
    url("/sign-in", 0.5, "yearly"),

    // Legal
    url("/terms",          0.3, "monthly"),
    url("/privacy",        0.3, "monthly"),
    url("/dpa",            0.3, "monthly"),
    url("/refund-policy",  0.3, "monthly"),
    url("/acceptable-use", 0.3, "monthly"),
    url("/cookies",        0.3, "monthly"),
    url("/grievance",      0.3, "monthly"),
    url("/sub-processors", 0.3, "monthly"),
  ];
}
