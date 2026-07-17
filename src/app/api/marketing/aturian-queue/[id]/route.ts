import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, forbidden, notFound, badRequest, serverError, ok } from '@/lib/api/respond'
import { resolveAturianQueueAssignee } from '@/lib/crm/aturian-assignees'

async function canActOnQueue(adminClient: ReturnType<typeof createAdminClient>, userId: string, isAdmin: boolean) {
  if (isAdmin) return true
  const amy = await resolveAturianQueueAssignee(adminClient)
  return amy?.id === userId
}

// GET /api/marketing/aturian-queue/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()
  const { id } = await params

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.from('aturian_customer_queue').select('*').eq('id', id).single()
  if (error || !data) return notFound('Queue entry not found')

  const userIds = [...new Set([data.assigned_to, data.created_by, data.completed_by].filter(Boolean))]
  const [{ data: users }, { data: files }] = await Promise.all([
    userIds.length > 0
      ? adminClient.from('users').select('id, display_name').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    adminClient.from('crm_files').select('*').eq('aturian_queue_id', id),
  ])
  const usersMap: Record<string, string> = {}
  for (const u of users ?? []) usersMap[u.id] = u.display_name

  return ok({
    ...data,
    assigned_user: data.assigned_to ? { id: data.assigned_to, display_name: usersMap[data.assigned_to] ?? null } : null,
    claimed_user: data.claimed_by ? { id: data.claimed_by, display_name: usersMap[data.claimed_by] ?? null } : null,
    created_by_user: data.created_by ? { id: data.created_by, display_name: usersMap[data.created_by] ?? null } : null,
    completed_by_user: data.completed_by ? { id: data.completed_by, display_name: usersMap[data.completed_by] ?? null } : null,
    files: files ?? [],
  })
}

// PATCH /api/marketing/aturian-queue/[id]  { action: 'claim' | 'complete' }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()
  const { id } = await params

  const adminClient = createAdminClient()

  const allowed = await canActOnQueue(adminClient, appUser.id, appUser.is_admin)
  if (!allowed) return forbidden()

  const { data: current, error: fetchError } = await adminClient
    .from('aturian_customer_queue')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError || !current) return notFound('Queue entry not found')

  const { action } = await req.json()

  if (action === 'complete') {
    if (current.status !== 'new') return badRequest('Can only complete new entries')
    const { data, error } = await adminClient
      .from('aturian_customer_queue')
      .update({ status: 'complete', completed_by: appUser.id, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return serverError(error.message)
    if (current.task_id) {
      await adminClient.from('crm_tasks').update({ status: 'completed', progress: 100 }).eq('id', current.task_id)
    }
    return ok(data)
  }

  return badRequest('Invalid action')
}
