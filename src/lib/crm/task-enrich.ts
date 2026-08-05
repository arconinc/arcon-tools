import type { createAdminClient } from '@/lib/supabase/admin'

// Attaches assigned_to_name to a list of crm_tasks rows — shared by the
// customer/vendor/contact/opportunity detail routes, which each embed a
// small "open tasks" list and need the assignee's display name.
export async function withAssigneeNames<T extends { assigned_to: string | null }>(
  adminClient: ReturnType<typeof createAdminClient>,
  tasks: T[]
): Promise<(T & { assigned_to_name: string | null })[]> {
  const ids = [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))] as string[]
  if (ids.length === 0) return tasks.map((t) => ({ ...t, assigned_to_name: null }))

  const { data } = await adminClient.from('users').select('id, display_name').in('id', ids)
  const nameById: Record<string, string> = {}
  for (const u of data ?? []) nameById[u.id] = u.display_name

  return tasks.map((t) => ({ ...t, assigned_to_name: t.assigned_to ? (nameById[t.assigned_to] ?? null) : null }))
}
