import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, notFound, serverError, ok } from '@/lib/api/respond'

// DELETE /api/marketing/vendors/[id]/files/[fileId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { id, fileId } = await params
  const adminClient = createAdminClient()

  const { data: file } = await adminClient
    .from('crm_files')
    .select('id, added_by')
    .eq('id', fileId)
    .eq('vendor_id', id)
    .single()

  if (!file) return notFound('File not found')

  // Only uploader or admin can delete
  if (file.added_by !== appUser.id && !appUser.is_admin) {
    return unauthorized()
  }

  const { error } = await adminClient.from('crm_files').delete().eq('id', fileId)
  if (error) return serverError(error.message)
  return ok({ ok: true })
}
