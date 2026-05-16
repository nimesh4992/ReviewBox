import type { MetadataRoute } from "next";

const RAW_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";
const BASE_URL = RAW_URL.startsWith("http") ? RAW_URL : `https://${RAW_URL}`;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/terms", "/privacy", "/sign-in", "/sign-up"],
        disallow: [
          "/dashboard",
          "/reviews",
          "/automations",
          "/reply-kit",
          "/incidents",
          "/releases",
          "/settings",
          "/billing",
          "/onboarding",
          "/admin",
          "/api/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
