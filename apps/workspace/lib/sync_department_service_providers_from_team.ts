import type { SupabaseClient, User } from '@supabase/supabase-js';

type ProviderEntry = { id: string; name: string };

/**
 * Coerces `user_metadata.departments` to a list of positive integer department ids.
 */
export function normalizeDepartmentIdsFromUserMetadata(
  raw: unknown
): number[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === "number" ? x : Number(x)))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function displayNameForServiceProviderInMeta(
  u: Pick<User, "id" | "email" | "user_metadata">
): string {
  const m = u.user_metadata as Record<string, unknown> | undefined;
  const n = m?.name;
  if (typeof n === "string" && n.trim() !== "") return n.trim();
  return u.email?.split("@")[0] ?? "Unknown";
}

/**
 * Makes `departments.meta_data.service_providers` match a team member’s
 * `user_metadata.departments` selection for a service provider. Removes
 * the member from all other departments in the workspace.
 */
export async function syncDepartmentServiceProvidersWithTeamDepartments(
  adminClient: SupabaseClient,
  workspaceId: string | number,
  member: Pick<User, "id" | "email" | "user_metadata">,
  selectedDepartmentIds: number[]
): Promise<void> {
  const memberId = member.id;
  const displayName = displayNameForServiceProviderInMeta(member);
  const want = new Set(selectedDepartmentIds);
  const ws = Number(workspaceId);

  const { data: depts, error: selErr } = await adminClient
    .from("departments")
    .select("id, meta_data")
    .eq("workspace_id", ws)
    .eq("flag", true);

  if (selErr) {
    console.error("syncDepartmentServiceProvidersWithTeamDepartments: select", selErr);
    return;
  }
  if (!depts?.length) return;

  for (const row of depts) {
    const rowId = (row as { id: number }).id;
    const meta = ((row as { meta_data: Record<string, unknown> | null })
      .meta_data ?? {}) as Record<string, unknown>;
    const rawSps = meta.service_providers;
    const list: ProviderEntry[] = Array.isArray(rawSps)
        ? (rawSps as unknown[]).reduce<ProviderEntry[]>((acc, item) => {
          if (!item || typeof item !== "object" || !("id" in item)) return acc;
          const o = item as unknown as Record<string, unknown>;
          const id = o["id"];
          if (typeof id !== "string") return acc;
          const name = o["name"];
          acc.push({
            id,
            name: typeof name === "string" ? name : "",
          });
          return acc;
        }, [])
      : [];

    const withoutMember = list.filter((p) => p.id !== memberId);
    const shouldBeAssigned = want.has(rowId);
    const next: ProviderEntry[] = shouldBeAssigned
      ? [
          ...withoutMember,
          { id: memberId, name: displayName },
        ]
      : withoutMember;

    const key = (a: ProviderEntry[]) =>
      [...a]
        .sort((x, y) => x.id.localeCompare(y.id))
        .map((p) => `${p.id}:${p.name}`)
        .join("|");
    if (key(list) === key(next)) continue;

    const newMeta = { ...meta, service_providers: next };
    const { error: upErr } = await adminClient
      .from("departments")
      .update({ meta_data: newMeta as Record<string, unknown> })
      .eq("id", rowId);
    if (upErr) {
      console.error(
        "syncDepartmentServiceProvidersWithTeamDepartments: update",
        rowId,
        upErr
      );
    }
  }
}
