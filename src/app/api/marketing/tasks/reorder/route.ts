import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// PATCH /api/marketing/tasks/reorder
// Body: { updates: [{ id: string, sort_order: number, status?: string }] }
export async function PATCH(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const updates: { id: string; sort_order: number; status?: string }[] = body.updates

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates array required' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const now = new Date().toISOString()

  // Run all updates in parallel
  const results = await Promise.all(
    updates.map(({ id, sort_order, status }) => {
      const patch: Record<string, unknown> = { sort_order, updated_at: now }
      if (status !== undefined) patch.status = status
      return adminClient.from('crm_tasks').update(patch).eq('id', id)
    })
  )

  const failed = results.filter((r) => r.error)
  if (failed.length > 0) {
    return NextResponse.json({ error: failed[0].error!.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
