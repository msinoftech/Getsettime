import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Aggregate booking counts for the current workspace (no list filters).
 * Used for dashboard-style stats that stay stable when the list is filtered.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") || null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace ID not found" },
        { status: 400 }
      );
    }

    const w = String(workspaceId);

    const table = () =>
      supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", w);

    const [
      { count: total, error: errTotal },
      { count: confirmed, error: errConfirmed },
      { count: pending, error: errPending },
      { count: cancelled, error: errCancelled },
    ] = await Promise.all([
      table(),
      table().eq("status", "confirmed"),
      table().eq("status", "pending"),
      table().eq("status", "cancelled"),
    ]);

    const firstErr =
      errTotal || errConfirmed || errPending || errCancelled;
    if (firstErr) {
      console.error("Error fetching booking stats:", firstErr);
      return NextResponse.json(
        { error: firstErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      total: total ?? 0,
      confirmed: confirmed ?? 0,
      pending: pending ?? 0,
      cancelled: cancelled ?? 0,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error:", error);
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
