import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, ok } from '@/lib/api/respond'
import { isVendorRelationsManager } from '@/lib/marketing/vendor-relations-access'

// GET /api/marketing/vendor-relations/slots/can-edit — lets the client know whether
// to show slot management controls, without exposing group membership another way.
export async function GET() {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const adminClient = createAdminClient()
  const canEdit = await isVendorRelationsManager(adminClient, appUser.id, appUser.is_admin)
  return ok({ canEdit })
}
