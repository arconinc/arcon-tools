// Derives a user's Team memberships from a `group_memberships!...(groups(...))`
// join result, filtered to active assignment_pool-capability groups.
export function userTeamsFromMemberships(groupMemberships: unknown): { id: string; name: string; color: string }[] {
  const memberships = Array.isArray(groupMemberships) ? groupMemberships : []
  return memberships
    .map((membership: any) => membership.groups)
    .filter((group: any) => group?.is_active && group?.source_type === 'assignment_pool')
    .map((group: any) => ({ id: group.id, name: group.name, color: group.color }))
}
