import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateWorkspace, updateUserWorkspaceMetadata } from "@/lib/workspace-service";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
    const supabaseServiceKey = (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
      ""
    ).trim();

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: authError,
    } = await verifyClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const meta = user.user_metadata ?? {};
    const name = (meta.name as string) || user.email?.split("@")[0] || "User";
    const userEmail = user.email || "";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get or create workspace (ensures one user = one workspace)
    const { data: workspaceResult, error: workspaceError } = await getOrCreateWorkspace({
      userId: user.id,
      userName: name,
      userEmail,
      supabaseAdmin,
    });

    if (workspaceError || !workspaceResult) {
      console.error("Bootstrap workspace error:", workspaceError);
      return NextResponse.json({ error: "Failed to get or create workspace" }, { status: 500 });
    }

    // Update user metadata with workspace information
    const { error: updateError } = await updateUserWorkspaceMetadata(
      user.id,
      workspaceResult.workspaceId,
      meta,
      supabaseAdmin
    );

    if (updateError) {
      console.error("Bootstrap user update error:", updateError);
      return NextResponse.json({ error: "Failed to update user metadata" }, { status: 500 });
    }

    return NextResponse.json({ workspace_id: workspaceResult.workspaceId });
  } catch (err: unknown) {
    console.error("Bootstrap workspace error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
