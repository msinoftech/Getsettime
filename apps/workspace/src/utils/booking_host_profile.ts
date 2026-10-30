export type BookingHostProfileHighlights = {
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  education: string | null;
  experience: string | null;
  specialty: string | null;
  bio: string | null;
};

type HostProfileMember = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  education?: string | null;
  experience?: string | null;
  specialty?: string | null;
  bio?: string | null;
  deactivated?: boolean;
};

function highlights_from_member(member: HostProfileMember | undefined): BookingHostProfileHighlights | null {
  if (!member || member.deactivated) return null;

  const education = member.education?.trim() || null;
  const experience = member.experience?.trim() || null;
  const specialty = member.specialty?.trim() || null;
  const bio = member.bio?.trim() || null;

  if (!education && !experience && !specialty && !bio) return null;

  return {
    name: member.name?.trim() || null,
    email: member.email?.trim() || null,
    avatar_url: member.avatar_url?.trim() || null,
    education,
    experience,
    specialty,
    bio,
  };
}

/** Profile highlights for a specific workspace member (by user id). */
export function resolve_member_profile_highlights(
  members: HostProfileMember[],
  memberId: string | null | undefined
): BookingHostProfileHighlights | null {
  const id = memberId?.trim();
  if (!id) return null;
  return highlights_from_member(members.find((m) => m.id === id));
}

/** Workspace owner highlights (main public booking link). */
export function resolve_workspace_owner_profile_highlights(
  members: HostProfileMember[],
  workspaceOwnerUserId: string | null
): BookingHostProfileHighlights | null {
  return resolve_member_profile_highlights(members, workspaceOwnerUserId);
}

/**
 * @deprecated Use resolve_workspace_owner_profile_highlights / resolve_member_profile_highlights.
 * Kept for callers that pick owner vs fixed provider exclusively.
 */
export function resolve_booking_host_profile_highlights(
  members: HostProfileMember[],
  workspaceOwnerUserId: string | null,
  fixedServiceProviderId?: string | null
): BookingHostProfileHighlights | null {
  const targetId = fixedServiceProviderId?.trim() || workspaceOwnerUserId;
  return resolve_member_profile_highlights(members, targetId);
}
