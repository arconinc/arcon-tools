import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// DELETE /api/crm/tasks/[id]/comments/[cid]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cid } = await params
  const adminClient = createAdminClient()

  // Only comment owner or admin can delete
  const { data: comment } = await adminClient
    .from('crm_task_comments')
    .select('user_id')
    .eq('id', cid)
    .single()

  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (comment.user_id !== appUser.id && !appUser.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await adminClient.from('crm_task_comments').delete().eq('id', cid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
