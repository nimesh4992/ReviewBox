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

    // Product. The hub targets "app review management" (170/mo, KD 18) — the
    // highest-value term reachable at our current authority. The AppFollow page
    // targets the KD 0 modifier cluster ("appfollow alternative/competitors").
    //
    // Only /alternatives/appfollow is listed. /vs/appfollow 301s to it
    // (next.config.ts) and advertising a redirect wastes the crawl.
    url("/app-review-management",   0.9, "monthly"),
    url("/alternatives/appfollow",  0.8, "monthly"),

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

    // No /sign-in or /sign-up.
    //
    // They were listed here at priority 0.7 and 0.5, but middleware redirects
    // both to app.tryreviewbox.com — and every public route on the app host is
    // served with `X-Robots-Tag: noindex, nofollow`. So the sitemap was telling
    // Google to index two URLs whose only possible outcome is a 307 into a page
    // it is then forbidden to index. That is crawl budget spent to reach a
    // closed door, on a domain that has very little to spend.
    //
    // The sign-up path still gets crawled — it is linked from the nav and every
    // closing CTA on the site. It just should not be advertised as a
    // destination.

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
