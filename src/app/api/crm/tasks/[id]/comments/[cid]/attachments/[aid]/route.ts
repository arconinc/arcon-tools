import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// DELETE /api/crm/tasks/[id]/comments/[cid]/attachments/[aid]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string; aid: string }> }
) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { aid } = await params
  const adminClient = createAdminClient()

  // Only uploader or admin can delete
  const { data: att } = await adminClient
    .from('crm_comment_attachments')
    .select('uploaded_by')
    .eq('id', aid)
    .single()

  if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (att.uploaded_by !== appUser.id && !appUser.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await adminClient.from('crm_comment_attachments').delete().eq('id', aid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
