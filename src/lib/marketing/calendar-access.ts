import { createAdminClient } from '@/lib/supabase/admin'
import { MARKETING_CALENDAR_EDITORS_GROUP_KEY } from '@/lib/groups/constants'

// Admins bypass; everyone else must belong to the marketing_calendar_editors group.
export async function isMarketingCalendarEditor(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  isAdmin: boolean
) {
  if (isAdmin) return true

  const { data } = await adminClient
    .from('group_memberships')
    .select('id, groups!group_memberships_group_id_fkey!inner(key, is_active)')
    .eq('user_id', userId)
    .eq('groups.key', MARKETING_CALENDAR_EDITORS_GROUP_KEY)
    .eq('groups.is_active', true)
    .maybeSingle()

  return Boolean(data)
}
