/** Split catalog department names into workspace ids vs names to create on accept/onboarding. */
export function splitDepartmentSelectionByName(
  selectedNames: string[],
  workspaceDepartments: { id: number; name: string }[]
): { departmentIds: number[]; departmentNames: string[] } {
  const idByLower = new Map(
    workspaceDepartments.map((d) => [d.name.trim().toLowerCase(), d.id])
  );
  const departmentIds: number[] = [];
  const departmentNames: string[] = [];
  const seenIds = new Set<number>();
  const seenNames = new Set<string>();

  for (const raw of selectedNames) {
    const name = raw.trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    const existingId = idByLower.get(lower);
    if (existingId != null) {
      if (!seenIds.has(existingId)) {
        seenIds.add(existingId);
        departmentIds.push(existingId);
      }
    } else if (!seenNames.has(lower)) {
      seenNames.add(lower);
      departmentNames.push(name);
    }
  }

  return { departmentIds, departmentNames };
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function normalizeDepartmentIdArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((x) => (typeof x === "number" ? x : Number(x)))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];
}
