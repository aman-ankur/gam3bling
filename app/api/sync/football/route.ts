import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase/server";
import { syncMatches } from "../../../../features/sync/sync-matches";

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  try {
    const result = await syncMatches({ supabase });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.SYNC_JOB_SECRET;

  if (!secret) {
    return false;
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerSecret = request.headers.get("x-sync-secret");

  return bearer === secret || headerSecret === secret;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Football sync failed";
}
