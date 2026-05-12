import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { generateReply } from "@/lib/groq";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { matchTemplate } from "@/lib/templates";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";

interface DraftRequestBody {
  reviewId: string;
  reviewBody: string;
  rating: number;
  tags: string[];
  tone: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth check
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // 2. Resolve plan from session claims
    const plan =
      (session.sessionClaims?.metadata as Record<string, string> | undefined)
        ?.plan ?? "free";

    // 3. Rate-limit check
    const { allowed } = await checkAiRateLimit(userId, plan);

    if (!allowed) {
      return NextResponse.json(
        { error: "LIMIT_REACHED", remaining: 0 },
        { status: 429 },
      );
    }

    // Parse body
    const body = (await req.json()) as DraftRequestBody;
    const { reviewId, reviewBody, rating, tags, tone } = body;

    // 4. Template match (free, no AI call)
    const templateReply = matchTemplate({ rating, body: reviewBody, tags });

    if (templateReply !== null) {
      console.log(
        JSON.stringify({ userId, plan, source: "template", reviewId }),
      );
      return NextResponse.json(
        { source: "template", reply: templateReply },
        { status: 200 },
      );
    }

    // 5. Fetch knowledge base context for workspace
    let context: string | undefined;
    const workspaceId = await getWorkspaceId(userId);
    if (workspaceId) {
      const sb = getServiceClient();
      const { data: kbEntries } = await sb
        .from("knowledge_base")
        .select("category, title, content")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(3);
      if (kbEntries && kbEntries.length > 0) {
        context =
          "Product context:\n" +
          kbEntries
            .map(
              (e: { category: string; title: string; content: string }) =>
                `[${e.category}] ${e.title}: ${e.content}`,
            )
            .join("\n");
      }
    }

    // 6. Groq generation
    const reply = await generateReply({ reviewBody, rating, tone, context });

    console.log(JSON.stringify({ userId, plan, source: "groq", reviewId, hasContext: !!context }));

    return NextResponse.json({ source: "groq", reply }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "AI_UNAVAILABLE") {
      return NextResponse.json({ error: "AI_UNAVAILABLE" }, { status: 503 });
    }

    console.error("Unexpected error in /api/reply/draft:", err);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    );
  }
}
