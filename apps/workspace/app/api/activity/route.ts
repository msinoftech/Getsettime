import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@app/db";
import { createClient } from "@supabase/supabase-js";

type ActivityType =
  | "booking"
  | "contact"
  | "event_type"
  | "department"
  | "service"
  | "availability"
  | "settings";

interface ActivityItem {
  id: string;
  type: ActivityType;
  action?: "created" | "updated" | "deleted";
  title: string;
  description: string;
  createdAt: string;
  entityId?: string | null;
  targetPath?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changedFields?: string[];
}

function to_activity_item(event: Record<string, unknown>): ActivityItem | null {
  const id = event.id ? String(event.id) : null;
  const type = event.entity_type ? String(event.entity_type) : null;
  const title = event.title ? String(event.title) : null;
  const createdAt = event.created_at ? String(event.created_at) : null;
  if (!id || !type || !title || !createdAt) return null;
  return {
    id,
    type: type as ActivityType,
    action: (event.action as "created" | "updated" | "deleted") || undefined,
    title,
    description: String(event.description || ""),
    createdAt,
    entityId: event.entity_id ? String(event.entity_id) : null,
    targetPath: event.target_path ? String(event.target_path) : null,
    before:
      typeof event.before_data === "object" && event.before_data !== null
        ? (event.before_data as Record<string, unknown>)
        : null,
    after:
      typeof event.after_data === "object" && event.after_data !== null
        ? (event.after_data as Record<string, unknown>)
        : null,
    changedFields: Array.isArray(event.changed_fields)
      ? event.changed_fields.map((field) => String(field))
      : [],
  };
}

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "") || null;
  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await verifyClient.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: "Workspace ID not found" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    const [eventsRes, configRes] = await Promise.all([
      supabase
        .from("activity_events")
        .select("id,entity_type,entity_id,action,title,description,before_data,after_data,changed_fields,target_path,created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(120),
      supabase
        .from("configurations")
        .select("id,settings,created_at,updated_at")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
    ]);

    const activity: ActivityItem[] = [];

    for (const event of eventsRes.data || []) {
      if (!event || typeof event !== "object") continue;
      const mapped = to_activity_item(event as Record<string, unknown>);
      if (mapped) {
        activity.push(mapped);
      }
    }

    const config = configRes.data;
    const settings = (config?.settings || {}) as Record<string, unknown>;
    const activityLog = Array.isArray(settings.activity_log) ? settings.activity_log : [];

    for (const log of activityLog) {
      if (!log || typeof log !== "object") continue;
      const item = log as Record<string, unknown>;
      if (!item.createdAt || !item.type || !item.title) continue;
      activity.push({
        id: String(item.id || `log-${item.type}-${item.createdAt}`),
        type: item.type as ActivityType,
        action: (item.action as "created" | "updated" | "deleted") || undefined,
        title: String(item.title),
        description: String(item.description || ""),
        createdAt: String(item.createdAt),
        entityId: item.entity_id ? String(item.entity_id) : null,
        targetPath: item.target_path ? String(item.target_path) : null,
        before:
          typeof item.before_data === "object" && item.before_data !== null
            ? (item.before_data as Record<string, unknown>)
            : null,
        after:
          typeof item.after_data === "object" && item.after_data !== null
            ? (item.after_data as Record<string, unknown>)
            : null,
        changedFields: Array.isArray(item.changed_fields)
          ? item.changed_fields.map((field) => String(field))
          : [],
      });
    }

    const sorted = activity
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((item, index, arr) => index === arr.findIndex((x) => x.id === item.id))
      .slice(0, 120);

    return NextResponse.json({ activities: sorted });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}
