import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalize_event_type_slug_input } from "@/src/features/event-types/event_type_slug";

function createAuthenticatedClient(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  return { supabase, token };
}

export async function GET(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { supabase, token } = result;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    const wid =
      typeof workspaceId === "number" ? workspaceId : Number(workspaceId);
    if (!Number.isFinite(wid)) {
      return NextResponse.json({ error: "Workspace ID not found" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const rawSlug = searchParams.get("slug") ?? "";
    const slug = normalize_event_type_slug_input(rawSlug);

    if (!slug) {
      return NextResponse.json({
        available: false,
        message: "Event URL slug is required.",
      });
    }

    const excludeRaw = searchParams.get("exclude_id");
    const excludeId =
      excludeRaw != null && excludeRaw !== "" ? Number(excludeRaw) : null;

    const { data: rows, error } = await supabase
      .from("event_types")
      .select("id, slug")
      .eq("workspace_id", wid);

    if (error) {
      console.error("check-slug:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const taken = (rows ?? []).some((row) => {
      if (
        excludeId != null &&
        Number.isFinite(excludeId) &&
        Number(row.id) === excludeId
      ) {
        return false;
      }
      return typeof row.slug === "string" && row.slug === slug;
    });

    if (taken) {
      return NextResponse.json({
        available: false,
        message:
          "This URL slug is already used by another event type, Please try a different slug.",
      });
    }

    return NextResponse.json({ available: true, slug });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("check-slug:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
