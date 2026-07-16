import { createAdminClient } from '@/lib/supabase/admin'

type AturianAssigneeKind = 'customer' | 'supplier'

type AturianAssignee = {
  id: string
  display_name: string | null
  email: string | null
}

const ATURIAN_ASSIGNEES: Record<AturianAssigneeKind, { label: string; displayName: string; match: 'exact' | 'prefix' }> = {
  customer: { label: 'Amy Wheatcraft', displayName: 'Amy Wheatcraft', match: 'exact' },
  supplier: { label: 'Jill Begley', displayName: 'Jill Begley', match: 'exact' },
}

export async function resolveAturianAssignee(adminClient: ReturnType<typeof createAdminClient>, kind: AturianAssigneeKind): Promise<AturianAssignee | null> {
  const config = ATURIAN_ASSIGNEES[kind]
  const namePattern = config.match === 'exact' ? config.displayName : `${config.displayName}%`

  const { data, error } = await adminClient
    .from('users')
    .select('id, display_name, email')
    .ilike('display_name', namePattern)
    .is('deactivated_at', null)
    .limit(2)

  if (error) {
    console.error(`[aturian-assignees] Failed to resolve ${config.label}:`, error)
    return null
  }

  if (!data || data.length === 0) {
    console.error(`[aturian-assignees] No active user matched ${config.label}`)
    return null
  }

  if (data.length > 1) {
    console.error(`[aturian-assignees] Multiple active users matched ${config.label}`)
    return null
  }

  return data[0] as AturianAssignee
}

const QUEUE_ASSIGNEE_NAMES = ['Amy Wheatcraft', 'Jill Begley']

export async function resolveAturianQueueAssignees(adminClient: ReturnType<typeof createAdminClient>): Promise<AturianAssignee[]> {
  const { data, error } = await adminClient
    .from('users')
    .select('id, display_name, email')
    .in('display_name', QUEUE_ASSIGNEE_NAMES)
    .is('deactivated_at', null)

  if (error) {
    console.error('[aturian-assignees] Failed to resolve queue assignees:', error)
    return []
  }

  return (data ?? []) as AturianAssignee[]
}
