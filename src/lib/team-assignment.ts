import type { SupabaseClient } from '@supabase/supabase-js'

export type AssigneeKind = 'team' | 'user'

export function encodeAssigneeValue(kind: AssigneeKind | null, id: string | null): string {
  return kind && id ? `${kind}:${id}` : ''
}

export function parseAssigneeValue(value: string): { kind: AssigneeKind; id: string } | null {
  if (value.startsWith('team:')) return { kind: 'team', id: value.slice(5) }
  if (value.startsWith('user:')) return { kind: 'user', id: value.slice(5) }
  return null
}

// Confirms a team_id refers to an active, assignment_pool-capability group.
export async function validateTeamId(adminClient: SupabaseClient, teamId: string): Promise<boolean> {
  const { data } = await adminClient
    .from('groups')
    .select('id, group_capabilities!inner(capability)')
    .eq('id', teamId)
    .eq('is_active', true)
    .eq('group_capabilities.capability', 'assignment_pool')
    .maybeSingle()
  return !!data
}

// Looks up an assignment_pool team's id by its stable key (e.g. 'sales', 'hr').
// Used by server-side task creators that used to write a department string,
// so auto-created tasks still show up on the matching team board.
export async function getTeamIdByKey(adminClient: SupabaseClient, key: string): Promise<string | null> {
  const { data } = await adminClient
    .from('groups')
    .select('id, group_capabilities!inner(capability)')
    .eq('key', key)
    .eq('is_active', true)
    .eq('group_capabilities.capability', 'assignment_pool')
    .maybeSingle()
  return data?.id ?? null
}
