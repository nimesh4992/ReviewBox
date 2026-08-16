/**
 * POST /api/billing/extend-trial
 *
 * Gives the workspace one more trial period. Self-serve on purpose: someone
 * who asks for more time is engaged, and making them email support to get it
 * loses more deals than the extra fortnight costs. Owners only, once per
 * workspace (lib/plans.ts MAX_TRIAL_EXTENSIONS).
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getWorkspaceId, isWorkspaceAdmin } from "@/lib/supabase-server";
import { apiError, captureAndError } from "@/lib/api-response";
import { rateLimit } from "@/lib/api-rate-limit";
import { audit } from "@/lib/audit";
import { extendTrial } from "@/lib/trial-service";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) return apiError("UNAUTHORIZED", 401);

    const rl = await rateLimit(req, userId, { bucket: "extend-trial", limit: 5, window: "1 h" });
    if (!rl.allowed) return apiError("RATE_LIMITED", 429);

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) return apiError("NO_WORKSPACE", 404);

    // Extending changes what the workspace is billed for, so it is an owner
    // action, not a member one.
    if (!(await isWorkspaceAdmin(userId, workspaceId))) {
      return apiError("FORBIDDEN", 403, "Only the workspace owner can extend the trial.");
    }

    const result = await extendTrial(workspaceId);
    if (!result.ok) {
      return apiError("INVALID_INPUT", 409, result.reason);
    }

    await audit({
      workspaceId,
      actorUserId: userId,
      action: "trial.extended",
      payload: { newEndsAt: result.newEndsAt },
    });

    return NextResponse.json({ ok: true, trialEndsAt: result.newEndsAt });
  } catch (err) {
    return captureAndError(err, "POST /api/billing/extend-trial");
  }
}
