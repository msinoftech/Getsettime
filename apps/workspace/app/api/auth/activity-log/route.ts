import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@app/db";
import { createClient } from "@supabase/supabase-js";
import type { user_auth_activity_log_request } from "@/src/types/user_auth_activity";

function parse_workspace_id(meta: Record<string, unknown> | undefined): number | null {
  if (!meta) return null;
  const raw = meta.workspace_id;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function client_ip(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  return null;
}

async function get_user_from_request(req: NextRequest) {
  const auth_header = req.headers.get("authorization");
  const token = auth_header?.replace(/^Bearer\s+/i, "") || null;
  if (!token) return null;

  const supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabase_anon_key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabase_url || !supabase_anon_key) return null;

  const verify_client = createClient(supabase_url, supabase_anon_key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error,
  } = await verify_client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function bearer_raw_token(req: NextRequest): string | null {
  const auth_header = req.headers.get("authorization");
  if (!auth_header) return null;
  return auth_header.replace(/^Bearer\s+/i, "").trim() || null;
}

/** Decode JWT payload (signature already verified via getUser). */
function jwt_payload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = (4 - (b64.length % 4)) % 4;
    b64 += "=".repeat(pad);
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function auth_session_id_from_access_token(token: string): string | null {
  const payload = jwt_payload(token);
  if (!payload) return null;
  const sid = payload.session_id;
  return typeof sid === "string" && sid.length > 0 ? sid : null;
}

function is_valid_body(body: unknown): body is user_auth_activity_log_request {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (b.event_type !== "login" && b.event_type !== "logout") return false;
  if (b.supabase_auth_event != null && typeof b.supabase_auth_event !== "string") return false;
  if (b.reason != null && typeof b.reason !== "string") return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const user = await get_user_from_request(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!is_valid_body(json)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const workspace_id = parse_workspace_id(user.user_metadata as Record<string, unknown>);
    if (!workspace_id) {
      return NextResponse.json({ error: "Workspace ID not found" }, { status: 400 });
    }

    const raw_token = bearer_raw_token(req);
    const auth_session_id =
      json.event_type === "login" && raw_token ? auth_session_id_from_access_token(raw_token) : null;

    const supabase = createSupabaseServerClient();
    const user_agent = req.headers.get("user-agent");
    const { error: insert_error } = await supabase.from("user_auth_activity").insert({
      user_id: user.id,
      workspace_id,
      event_type: json.event_type,
      supabase_auth_event: json.supabase_auth_event ?? null,
      reason: json.reason ?? null,
      ip_address: client_ip(req),
      user_agent: user_agent?.slice(0, 2000) ?? null,
      auth_session_id,
    });

    if (insert_error) {
      const msg = insert_error.message ?? "";
      const is_login_dup =
        json.event_type === "login" &&
        (insert_error.code === "23505" ||
          msg.toLowerCase().includes("duplicate") ||
          msg.includes("unique constraint") ||
          msg.includes("uq_user_auth_activity_login_session"));
      if (is_login_dup) {
        return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
      }
      console.error("user_auth_activity insert:", insert_error);
      return NextResponse.json({ error: insert_error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error("POST auth/activity-log:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
