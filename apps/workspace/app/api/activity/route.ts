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
}

function isUpdated(createdAt?: string | null, updatedAt?: string | null) {
  if (!createdAt || !updatedAt) return false;
  return Math.abs(new Date(updatedAt).getTime() - new Date(createdAt).getTime()) > 5000;
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

    const [bookingsRes, contactsRes, eventTypesRes, departmentsRes, servicesRes, configRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id,invitee_name,status,created_at,updated_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("contacts")
        .select("id,name,email,created_at,updated_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("event_types")
        .select("id,title,created_at,updated_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("departments")
        .select("id,name,created_at,updated_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("services")
        .select("id,name,created_at,updated_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("configurations")
        .select("id,settings,created_at,updated_at")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
    ]);

    const activity: ActivityItem[] = [];

    for (const b of bookingsRes.data || []) {
      const time = b.updated_at || b.created_at;
      if (!time) continue;
      const updated = isUpdated(b.created_at, b.updated_at);
      activity.push({
        id: `booking-${b.id}-${time}`,
        type: "booking",
        title: updated ? "Booking updated" : "Booking created",
        description: `${b.invitee_name || "Someone"} (${b.status || "pending"})`,
        createdAt: time,
      });
    }

    for (const c of contactsRes.data || []) {
      const time = c.updated_at || c.created_at;
      if (!time) continue;
      const updated = isUpdated(c.created_at, c.updated_at);
      activity.push({
        id: `contact-${c.id}-${time}`,
        type: "contact",
        title: updated ? "Contact updated" : "Contact created",
        description: `${c.name || "Unnamed"}${c.email ? ` (${c.email})` : ""}`,
        createdAt: time,
      });
    }

    for (const e of eventTypesRes.data || []) {
      const time = e.updated_at || e.created_at;
      if (!time) continue;
      const updated = isUpdated(e.created_at, e.updated_at);
      activity.push({
        id: `event-type-${e.id}-${time}`,
        type: "event_type",
        title: updated ? "Event type updated" : "Event type created",
        description: e.title || "Untitled event type",
        createdAt: time,
      });
    }

    for (const d of departmentsRes.data || []) {
      const time = d.updated_at || d.created_at;
      if (!time) continue;
      const updated = isUpdated(d.created_at, d.updated_at);
      activity.push({
        id: `department-${d.id}-${time}`,
        type: "department",
        title: updated ? "Department updated" : "Department created",
        description: d.name || "Unnamed department",
        createdAt: time,
      });
    }

    for (const s of servicesRes.data || []) {
      const time = s.updated_at || s.created_at;
      if (!time) continue;
      const updated = isUpdated(s.created_at, s.updated_at);
      activity.push({
        id: `service-${s.id}-${time}`,
        type: "service",
        title: updated ? "Service updated" : "Service created",
        description: s.name || "Unnamed service",
        createdAt: time,
      });
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
      });
    }

    if (config) {
      const time = config.updated_at || config.created_at;
      if (time) {
        // activity.push({
        //   id: `config-settings-${config.id}-${time}`,
        //   type: "settings",
        //   title: "Workspace settings updated",
        //   description: "General workspace configuration was changed",
        //   createdAt: time,
        // });

        // if ((config.settings as Record<string, unknown>)?.availability) {
        //   activity.push({
        //     id: `config-availability-${config.id}-${time}`,
        //     type: "availability",
        //     title: "Availability timesheet updated",
        //     description: "Availability schedule or time slots were changed",
        //     createdAt: time,
        //   });
        // }
      }
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
