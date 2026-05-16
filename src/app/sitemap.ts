import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";

function url(path: string, priority: number, freq: MetadataRoute.Sitemap[number]["changeFrequency"]) {
  return { url: `${BASE_URL}${path}`, lastModified: new Date(), changeFrequency: freq, priority };
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // Core marketing
    url("/",          1.0, "weekly"),
    url("/pricing",   0.9, "weekly"),
    url("/compare",   0.9, "monthly"),
    url("/customers", 0.8, "monthly"),

    // Company
    url("/about",     0.7, "monthly"),
    url("/blog",      0.8, "weekly"),
    url("/careers",   0.7, "weekly"),
    url("/changelog", 0.7, "weekly"),
    url("/contact",   0.6, "monthly"),
    url("/status",    0.5, "daily"),

    // Help & FAQ
    url("/faq",                            0.7, "monthly"),
    url("/help",                           0.7, "monthly"),
    url("/help/connect-google-play",       0.6, "monthly"),
    url("/help/connect-app-store",         0.6, "monthly"),
    url("/help/ai-replies",                0.6, "monthly"),
    url("/help/automation",                0.6, "monthly"),

    // Blog
    url("/blog/ai-cost-reduction",         0.7, "monthly"),

    // Case studies
    url("/customers/acme-banking",         0.6, "monthly"),

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
  ];
}
