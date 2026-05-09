import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const offset = (page - 1) * limit;
    const workspace_id_param = searchParams.get("workspace_id")?.trim() || "";
    const user_id_param = searchParams.get("user_id")?.trim() || "";

    if (user_id_param) {
      if (!UUID_RE.test(user_id_param)) {
        return NextResponse.json({ error: "Invalid user_id" }, { status: 400 });
      }

      let q = supabase
        .from("user_auth_activity")
        .select("*, workspaces(name)", { count: "exact" })
        .eq("user_id", user_id_param)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (workspace_id_param) {
        const wid = parseInt(workspace_id_param, 10);
        if (!Number.isFinite(wid)) {
          return NextResponse.json({ error: "Invalid workspace_id" }, { status: 400 });
        }
        q = q.eq("workspace_id", wid);
      }

      const { data, error, count } = await q;

      if (error) {
        console.error("user_auth_activity GET (detail):", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        rows: data ?? [],
        total: count ?? 0,
        page,
        limit,
      });
    }

    let q = supabase
      .from("user_auth_activity_user_summary")
      .select("*", { count: "exact" })
      .order("last_activity_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (workspace_id_param) {
      const wid = parseInt(workspace_id_param, 10);
      if (!Number.isFinite(wid)) {
        return NextResponse.json({ error: "Invalid workspace_id" }, { status: 400 });
      }
      q = q.eq("workspace_id", wid);
    }

    const { data, error, count } = await q;

    if (error) {
      console.error("user_auth_activity_user_summary GET:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      groups: data ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err: unknown) {
    console.error("GET user-auth-activity:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
