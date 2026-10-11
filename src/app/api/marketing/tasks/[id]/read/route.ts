import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, ok, serverError } from '@/lib/api/respond'

// POST /api/marketing/tasks/[id]/read — mark the task's comments read for the caller
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { id: taskId } = await params
  const { error } = await createAdminClient()
    .from('crm_task_comment_reads')
    .upsert(
      { task_id: taskId, user_id: appUser.id, last_read_at: new Date().toISOString() },
      { onConflict: 'task_id,user_id' },
    )

  if (error) return serverError(error.message)
  return ok({ ok: true })
}
