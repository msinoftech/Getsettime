import { createSupabaseServerClient } from "@app/db";

export interface ActivityLogEntry {
  id: string;
  type: "booking" | "contact" | "event_type" | "department" | "service" | "availability" | "settings";
  action: "created" | "updated" | "deleted";
  title: string;
  description: string;
  createdAt: string;
}

function normalizeLogEntries(raw: unknown): ActivityLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is ActivityLogEntry => {
    return Boolean(
      item &&
        typeof item === "object" &&
        "id" in item &&
        "type" in item &&
        "action" in item &&
        "title" in item &&
        "description" in item &&
        "createdAt" in item
    );
  });
}

export async function appendActivityLog(workspaceId: string | number, entry: Omit<ActivityLogEntry, "id" | "createdAt">) {
  const supabase = createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const logEntry: ActivityLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: nowIso,
    ...entry,
  };

  const { data: existingConfig } = await supabase
    .from("configurations")
    .select("id,settings")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const currentSettings = (existingConfig?.settings || {}) as Record<string, unknown>;
  const currentLog = normalizeLogEntries((currentSettings as Record<string, unknown>).activity_log);
  const updatedLog = [logEntry, ...currentLog].slice(0, 300);
  const mergedSettings = {
    ...currentSettings,
    activity_log: updatedLog,
  };

  if (existingConfig?.id) {
    await supabase
      .from("configurations")
      .update({ settings: mergedSettings })
      .eq("id", existingConfig.id);
  } else {
    await supabase
      .from("configurations")
      .insert({
        workspace_id: workspaceId,
        settings: mergedSettings,
      });
  }
}
