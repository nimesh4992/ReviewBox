import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { rateLimit } from "@/lib/api-rate-limit";

export const dynamic = "force-dynamic";

interface SlackChannel {
  id:        string;
  name:      string;
  is_private: boolean;
}

interface SlackChannelListResponse {
  ok:       boolean;
  channels?: SlackChannel[];
  error?:   string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const rl = await rateLimit(req, workspaceId, {
    bucket: "slack-channels",
    limit:  10,
    window: "1 m",
  });
  if (!rl.allowed) return apiError("RATE_LIMITED", 429);

  const sb = getServiceClient();
  const { data } = await sb
    .from("workspace_slack")
    .select("access_token")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const token = (data as { access_token?: string } | null)?.access_token;
  if (!token) return apiError("NOT_FOUND", 404);

  let slackData: SlackChannelListResponse;
  try {
    const res = await fetch(
      "https://slack.com/api/conversations.list?limit=200&exclude_archived=true",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    slackData = (await res.json()) as SlackChannelListResponse;
  } catch {
    return apiError("SERVICE_UNAVAILABLE", 502, "Failed to fetch channels from Slack");
  }

  if (!slackData.ok) {
    return apiError("SERVICE_UNAVAILABLE", 502, "Slack API error");
  }

  const channels = (slackData.channels ?? []).map((c) => ({
    id:        c.id,
    name:      c.name,
    isPrivate: c.is_private,
  }));

  return NextResponse.json({ channels });
}
