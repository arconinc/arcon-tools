import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, ok, serverError } from '@/lib/api/respond'

// GET /api/teams — active assignment_pool groups, for task assignment/filter
// dropdowns. Open to any authenticated user (not admin-gated): non-admins can
// assign tasks to existing teams, they just can't create/edit teams.
export async function GET() {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { data, error } = await createAdminClient()
    .from('groups')
    .select('id, key, name, color, group_capabilities!inner(capability)')
    .eq('is_active', true)
    .eq('group_capabilities.capability', 'assignment_pool')
    .order('sort_order')
    .order('name')

  if (error) return serverError(error.message)
  return ok((data ?? []).map(({ id, key, name, color }) => ({ id, key, name, color })))
}
