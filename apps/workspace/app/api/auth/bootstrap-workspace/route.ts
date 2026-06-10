import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getOrCreateWorkspace,
  updateUserWorkspaceMetadata,
  resolveAcceptedInviteForEmail,
  syncInvitedUserWorkspaceMetadata,
} from "@/lib/workspace-service";
import { sendWorkspaceWelcomeEmail } from "@/lib/send-workspace-welcome-email";
import { resolveRegistrationGeoFromHeaders } from "@/lib/ipapi-geo";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // JWT custom claims can lag after invite accept; auth.users metadata is authoritative.
    const { data: authUserRow } = await supabaseAdmin.auth.admin.getUserById(user.id);
    const meta = authUserRow?.user?.user_metadata ?? user.user_metadata ?? {};
    const name = (meta.name as string) || user.email?.split("@")[0] || "User";
    const userEmail = user.email || "";

    const parseWorkspaceId = (raw: unknown): number => {
      if (typeof raw === "number" && Number.isFinite(raw)) return raw;
      if (typeof raw === "string") {
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? n : NaN;
      }
      return NaN;
    };

    const acceptedInvite = userEmail
      ? await resolveAcceptedInviteForEmail(supabaseAdmin, userEmail)
      : null;
    if (acceptedInvite) {
      const { error: syncErr } = await syncInvitedUserWorkspaceMetadata(
        user.id,
        acceptedInvite,
        supabaseAdmin
      );
      if (syncErr) {
        return NextResponse.json({ error: syncErr }, { status: 500 });
      }
      return NextResponse.json({ workspace_id: acceptedInvite.workspaceId });
    }

    const existingWorkspaceId = parseWorkspaceId(meta.workspace_id);
    if (Number.isFinite(existingWorkspaceId) && existingWorkspaceId > 0) {
      return NextResponse.json({ workspace_id: existingWorkspaceId });
    }

    const invitedAt = meta.invited_at;
    const isInvitedMember =
      typeof invitedAt === "string"
        ? invitedAt.trim() !== ""
        : invitedAt != null;
    const invitedRole = typeof meta.role === "string" ? meta.role : "";
    if (
      isInvitedMember ||
      invitedRole === "service_provider" ||
      invitedRole === "manager" ||
      invitedRole === "staff" ||
      invitedRole === "customer"
    ) {
      return NextResponse.json(
        { error: "Invited team member is missing workspace assignment. Contact your workspace admin." },
        { status: 400 }
      );
    }

    let browserTimezone: string | undefined;
    try {
      const body = await req.json() as { timezone?: string };
      browserTimezone = typeof body.timezone === "string" ? body.timezone.trim() : undefined;
    } catch {
      browserTimezone = undefined;
    }

    const registrationGeo = await resolveRegistrationGeoFromHeaders(
      req.headers,
      browserTimezone
    );

    // Get or create workspace (ensures one user = one workspace) — workspace owners / self-signup only
    const { data: workspaceResult, error: workspaceError } = await getOrCreateWorkspace({
      userId: user.id,
      userName: name,
      userEmail,
      supabaseAdmin,
      registrationGeo,
    });

    if (workspaceError || !workspaceResult) {
      console.error("Bootstrap workspace error:", workspaceError);
      return NextResponse.json({ error: "Failed to get or create workspace" }, { status: 500 });
    }

    const { error: updateError } = await updateUserWorkspaceMetadata(
      user.id,
      workspaceResult.workspaceId,
      meta,
      supabaseAdmin,
      workspaceResult.isNewWorkspace
    );

    if (updateError) {
      console.error("Bootstrap user update error:", updateError);
      return NextResponse.json({ error: "Failed to update user metadata" }, { status: 500 });
    }

    if (workspaceResult.isNewWorkspace && userEmail) {
      sendWorkspaceWelcomeEmail({
        to: userEmail,
        workspaceId: workspaceResult.workspaceId,
        supabaseAdmin,
      }).catch((err) => console.error("Welcome email failed (non-critical):", err));
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
