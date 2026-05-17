import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient } from "@/lib/supabase-server";

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;
const RESERVED = new Set([
  "admin", "api", "app", "blog", "billing", "careers", "changelog", "compare",
  "contact", "cookies", "customers", "dashboard", "dpa", "faq", "help",
  "inbox", "incidents", "onboarding", "pricing", "privacy", "refund",
  "releases", "reports", "reviews", "settings", "sign-in", "sign-up",
  "status", "support", "terms", "www",
]);

interface CheckResult {
  available: boolean;
  reason?: "INVALID" | "RESERVED" | "TAKEN";
  suggestions: string[];
}

export async function GET(req: NextRequest): Promise<NextResponse<CheckResult | { error: string }>> {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const slug = (req.nextUrl.searchParams.get("slug") ?? "").trim().toLowerCase();

  if (!slug || !SLUG_PATTERN.test(slug)) {
    return NextResponse.json({
      available: false,
      reason: "INVALID",
      suggestions: [],
    });
  }

  if (RESERVED.has(slug)) {
    return NextResponse.json({
      available: false,
      reason: "RESERVED",
      suggestions: [`${slug}-co`, `${slug}-app`, `${slug}-team`].filter((s) => !RESERVED.has(s)),
    });
  }

  const sb = getServiceClient();
  const { data: existing } = await sb
    .from("workspaces")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    const suggestions = await findAvailableSuggestions(sb, slug);
    return NextResponse.json({
      available: false,
      reason: "TAKEN",
      suggestions,
    });
  }

  return NextResponse.json({ available: true, suggestions: [] });
}

async function findAvailableSuggestions(
  sb: ReturnType<typeof getServiceClient>,
  base: string,
): Promise<string[]> {
  const candidates = [
    `${base}-co`,
    `${base}-app`,
    `${base}-team`,
    `${base}-${Math.floor(Math.random() * 90) + 10}`,
  ].filter((c) => !RESERVED.has(c) && SLUG_PATTERN.test(c));

  const { data: taken } = await sb
    .from("workspaces")
    .select("slug")
    .in("slug", candidates);

  const takenSet = new Set((taken ?? []).map((r) => r.slug as string));
  return candidates.filter((c) => !takenSet.has(c)).slice(0, 3);
}
