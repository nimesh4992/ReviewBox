import type { MetadataRoute } from "next";

const RAW_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";
const BASE_URL = RAW_URL.startsWith("http") ? RAW_URL : `https://${RAW_URL}`;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Allowing "/" already permits everything not explicitly disallowed,
        // so the disallow list below is the authoritative part. The previous
        // allow list also named /terms, /privacy, /sign-in and /sign-up, which
        // was redundant and read as though those were the only allowed pages.
        allow: "/",
        // Every authenticated or utility route. These are also protected by
        // middleware, so a crawler would not get content anyway — but an
        // incomplete list here means crawl budget spent on redirects.
        disallow: [
          "/dashboard",
          "/inbox",
          "/reviews",
          "/automations",
          "/reply-kit",
          "/incidents",
          "/releases",
          "/sentiment",
          "/competitors",
          "/aso",
          "/reports",
          "/settings",
          "/billing",
          "/onboarding",
          "/account-deleted",
          "/invite",
          "/admin",
          "/api/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
