import { createAdminClient } from '@/lib/supabase/admin'
import { getUserAssignmentGroupKeys } from '@/lib/auth/group-access'

// Admins bypass; everyone else must belong to the "marketing" assignment pool group.
export async function isVendorRelationsManager(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string,
  isAdmin: boolean
) {
  if (isAdmin) return true

  const groups = await getUserAssignmentGroupKeys(adminClient, userId)
  return groups.includes('marketing')
}
