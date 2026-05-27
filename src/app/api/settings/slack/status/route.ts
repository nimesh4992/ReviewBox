import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface SlackRow {
  slack_channel_name: string;
  slack_team_name:    string | null;
}

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return NextResponse.json({ connected: false, channelName: null, teamName: null });

  const sb = getServiceClient();
  const { data } = await sb
    .from("workspace_slack")
    .select("slack_channel_name, slack_team_name")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const row = data as SlackRow | null;

  return NextResponse.json({
    connected:   !!row,
    channelName: row?.slack_channel_name ?? null,
    teamName:    row?.slack_team_name    ?? null,
  });
}
