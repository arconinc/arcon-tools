// Derives a user's Team memberships from a `group_memberships!...(groups(...))`
// join result, filtered to active groups with the assignment_pool capability.
// A group's `source_type` records how it was created (department/role/manual/
// assignment_pool sync), not what it's capable of — a manually-created group
// can still carry the assignment_pool capability, so that's what makes it a
// "Team" (matches /api/teams and the admin Teams page's `isTeam` check).
export function userTeamsFromMemberships(groupMemberships: unknown): { id: string; name: string; color: string }[] {
  const memberships = Array.isArray(groupMemberships) ? groupMemberships : []
  return memberships
    .map((membership: any) => membership.groups)
    .filter((group: any) => group?.is_active && group?.group_capabilities?.some((c: any) => c.capability === 'assignment_pool'))
    .map((group: any) => ({ id: group.id, name: group.name, color: group.color }))
}
