/**
 * GET /api/aso/mine?appId=&limit=40
 *
 * Mines review text for keyword phrases users naturally write.
 * Zero external API calls — pure n-gram extraction from Supabase review text.
 *
 * Returns bigrams + trigrams ranked by:
 *   score = frequency × context_boost
 * where context_boost = 1.4 if phrase appears in positive reviews, 0.8 if only negative.
 *
 * Cross-references against tracked aso_keywords so UI can highlight gaps.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";

// ── Stop words (purely grammatical — we keep meaningful nouns/verbs) ──────────

const STOP = new Set([
  "a","an","the","and","or","but","nor","so","yet","for","of","in","on","at",
  "to","by","up","as","if","it","is","am","are","was","were","be","been","being",
  "have","has","had","do","does","did","will","would","could","should","may",
  "might","shall","can","need","dare","ought","used","this","that","these",
  "those","i","me","my","we","our","you","your","he","his","she","her","they",
  "them","their","who","which","what","when","where","how","all","each","every",
  "both","few","more","most","other","some","such","no","not","only","same",
  "than","too","very","just","also","with","from","about","into","through",
  "during","before","after","above","below","between","out","off","over","under",
  "then","once","here","there","while","although","because","since","though",
  "until","unless","even","still","already","now","get","got","getting","go",
  "going","gone","went","come","came","coming","make","made","making","take",
  "took","taking","see","saw","seen","know","knew","known","think","thought",
  "said","say","says","tell","told","ask","asked","want","wanted","like","liked",
  "really","quite","much","many","well","back","way","thing","things","time",
  "one","two","three","new","old","good","bad","big","small","etc","its",
  "been","re","ve","ll","t","s","d","m","o","don","doesn","didn","can",
  "would","could","should","must","let","put","set","try","tried","trying",
  "seems","seem","seemed","able","unable","feel","felt","feeling",
]);

// ── Tokenise one review into cleaned tokens ───────────────────────────────────

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[''`]/g, "")           // smart quotes
    .replace(/[^a-z\s-]/g, " ")      // keep hyphens (e.g. "easy-to-use")
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))  // strip leading/trailing hyphens
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

// ── Build n-grams from a token list ──────────────────────────────────────────

function ngrams(tokens: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    out.push(tokens.slice(i, i + n).join(" "));
  }
  return out;
}

// ── Deduplicate: if "push notification" ⊂ "push notifications", keep higher ──

function dedup(phrases: Map<string, number>): Map<string, number> {
  const keys = [...phrases.keys()];
  const result = new Map<string, number>();
  for (const phrase of keys) {
    // drop phrase if a near-identical longer phrase already has >= count
    const dominated = keys.some(
      (other) =>
        other !== phrase &&
        other.includes(phrase) &&
        (phrases.get(other) ?? 0) >= (phrases.get(phrase) ?? 0),
    );
    if (!dominated) result.set(phrase, phrases.get(phrase)!);
  }
  return result;
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface MinedPhrase {
  phrase: string;
  count: number;          // distinct reviews mentioning it
  score: number;          // count × context boost (for ranking)
  sentiment: "positive" | "negative" | "mixed";
  tracked: boolean;       // already in aso_keywords table
  /** Up to 2 short review snippets containing the phrase */
  examples: string[];
}

export interface MineKeywordsResult {
  phrases: MinedPhrase[];
  reviewsAnalyzed: number;
  trackedCount: number;
  gapCount: number;       // high-score phrases not yet tracked
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<NextResponse> {
  const EMPTY: MineKeywordsResult = {
    phrases: [], reviewsAnalyzed: 0, trackedCount: 0, gapCount: 0,
  };

  try {
    const session = await auth();
    if (!session?.userId) return NextResponse.json(EMPTY, { status: 401 });

    const workspaceId = await getWorkspaceId(session.userId);
    if (!workspaceId) return NextResponse.json(EMPTY);

    const url   = new URL(req.url);
    const appId = url.searchParams.get("appId");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "40"), 60);

    const sb = getServiceClient();

    // ── Fetch up to 500 recent reviews ───────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = (): any => {
      const q = sb.from("reviews").select("*").eq("workspace_id", workspaceId);
      return appId ? q.eq("app_id", appId) : q;
    };

    const { data: rows } = await base()
      .select("id, text:body, sentiment")
      .not("body", "is", null)
      .order("store_created_at", { ascending: false })
      .limit(500);

    const reviews = (rows ?? []) as { id: string; text: string; sentiment: string }[];

    // ── Fetch already-tracked keywords ───────────────────────────────────────
    const trackedQuery = appId
      ? sb.from("aso_keywords").select("keyword").eq("workspace_id", workspaceId).eq("app_id", appId)
      : sb.from("aso_keywords").select("keyword").eq("workspace_id", workspaceId);
    const { data: trackedRows } = await trackedQuery;
    const trackedSet = new Set(
      (trackedRows ?? []).map((r: { keyword: string }) => r.keyword.toLowerCase()),
    );

    // ── Extract n-grams ───────────────────────────────────────────────────────
    // phrase → Set of review IDs that contain it (count = unique reviews)
    const phraseReviewIds  = new Map<string, Set<string>>();
    const phrasePosCount   = new Map<string, number>();
    const phraseNegCount   = new Map<string, number>();
    const phraseExamples   = new Map<string, string[]>();

    for (const review of reviews) {
      if (!review.text?.trim()) continue;
      const tokens = tokenise(review.text);
      const candidates = [
        ...ngrams(tokens, 2),
        ...ngrams(tokens, 3),
      ];

      for (const phrase of candidates) {
        // Must have at least one token that's >= 4 chars (filters noise like "app use")
        if (!phrase.split(" ").some((t) => t.length >= 4)) continue;

        if (!phraseReviewIds.has(phrase)) {
          phraseReviewIds.set(phrase, new Set());
          phrasePosCount.set(phrase, 0);
          phraseNegCount.set(phrase, 0);
          phraseExamples.set(phrase, []);
        }

        const ids = phraseReviewIds.get(phrase)!;
        if (!ids.has(review.id)) {
          ids.add(review.id);
          if (review.sentiment === "positive") {
            phrasePosCount.set(phrase, (phrasePosCount.get(phrase) ?? 0) + 1);
          } else if (review.sentiment === "critical" || review.sentiment === "negative") {
            phraseNegCount.set(phrase, (phraseNegCount.get(phrase) ?? 0) + 1);
          }
          // store up to 2 example snippets
          const exs = phraseExamples.get(phrase)!;
          if (exs.length < 2) {
            const idx = review.text.toLowerCase().indexOf(phrase);
            if (idx !== -1) {
              const start = Math.max(0, idx - 30);
              const end   = Math.min(review.text.length, idx + phrase.length + 50);
              exs.push((start > 0 ? "…" : "") + review.text.slice(start, end).trim() + (end < review.text.length ? "…" : ""));
            }
          }
        }
      }
    }

    // ── Filter: must appear in ≥ 2 distinct reviews ───────────────────────────
    const freqMap = new Map<string, number>();
    for (const [phrase, ids] of phraseReviewIds) {
      if (ids.size >= 2) freqMap.set(phrase, ids.size);
    }

    // ── Dedup substrings ─────────────────────────────────────────────────────
    const deduped = dedup(freqMap);

    // ── Score + build output ─────────────────────────────────────────────────
    const results: MinedPhrase[] = [];
    for (const [phrase, count] of deduped) {
      const pos = phrasePosCount.get(phrase) ?? 0;
      const neg = phraseNegCount.get(phrase) ?? 0;
      const contextBoost = pos > neg ? 1.4 : neg > pos * 2 ? 0.7 : 1.0;
      const score = Math.round(count * contextBoost * 10) / 10;
      const sentiment: MinedPhrase["sentiment"] =
        pos > neg * 1.5 ? "positive" : neg > pos * 1.5 ? "negative" : "mixed";

      results.push({
        phrase,
        count,
        score,
        sentiment,
        tracked: trackedSet.has(phrase),
        examples: phraseExamples.get(phrase) ?? [],
      });
    }

    // Sort by score desc, take top `limit`
    results.sort((a, b) => b.score - a.score);
    const top = results.slice(0, limit);

    const trackedCount = top.filter((p) => p.tracked).length;
    const gapCount     = top.filter((p) => !p.tracked && p.score >= 3).length;

    return NextResponse.json({
      phrases: top,
      reviewsAnalyzed: reviews.length,
      trackedCount,
      gapCount,
    } satisfies MineKeywordsResult);
  } catch (err) {
    console.error("[GET /api/aso/mine]", err);
    return NextResponse.json(
      { phrases: [], reviewsAnalyzed: 0, trackedCount: 0, gapCount: 0 },
      { status: 500 },
    );
  }
}
