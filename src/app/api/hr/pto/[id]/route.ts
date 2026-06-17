import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PtoReason, PTO_REASON_LABELS } from '@/types'

type Params = { params: Promise<{ id: string }> }

// GET /api/hr/pto/[id] — get a single request (own only)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('id')
    .eq('google_id', user.id)
    .single()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: request, error } = await adminClient
    .from('pto_requests')
    .select('*')
    .eq('id', id)
    .eq('user_id', dbUser.id)
    .single()

  if (error || !request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ request })
}

// PUT /api/hr/pto/[id] — edit and resubmit (pending or denied only)
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('id, display_name')
    .eq('google_id', user.id)
    .single()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await adminClient
    .from('pto_requests')
    .select('id, status, task_id')
    .eq('id', id)
    .eq('user_id', dbUser.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status === 'approved') {
    return NextResponse.json({ error: 'Approved requests cannot be edited' }, { status: 400 })
  }

  const body = await req.json()
  const {
    start_date,
    end_date,
    start_half_day = false,
    end_half_day = false,
    reason,
    notes,
    signed_name,
  } = body

  if (!start_date || !end_date || !reason || !signed_name?.trim()) {
    return NextResponse.json({ error: 'start_date, end_date, reason, and signed_name are required' }, { status: 400 })
  }

  const validReasons: PtoReason[] = [
    'vacation', 'personal_leave', 'funeral_bereavement',
    'jury_duty', 'family_reasons', 'medical_leave', 'to_vote', 'other',
  ]
  if (!validReasons.includes(reason)) {
    return NextResponse.json({ error: 'Invalid reason' }, { status: 400 })
  }

  if (start_date > end_date) {
    return NextResponse.json({ error: 'start_date must be on or before end_date' }, { status: 400 })
  }

  const { data: updated, error: updateError } = await adminClient
    .from('pto_requests')
    .update({
      start_date,
      end_date,
      start_half_day,
      end_half_day,
      reason,
      notes: notes ?? null,
      signed_name: signed_name.trim(),
      signed_at: new Date().toISOString(),
      status: 'pending',
      reviewer_comment: null,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? 'Update failed' }, { status: 500 })
  }

  // Update linked task title + status if it exists
  if (existing.task_id) {
    const reasonLabel = PTO_REASON_LABELS[reason as PtoReason] ?? reason
    await adminClient
      .from('crm_tasks')
      .update({
        title: `PTO Request: ${dbUser.display_name} (${start_date} – ${end_date})`,
        status: 'not_started',
        assigned_to: null,
        description: `Reason: ${reasonLabel}${notes ? `\n\n${notes}` : ''}`,
      })
      .eq('id', existing.task_id)
  }

  return NextResponse.json({ request: updated })
}

// DELETE /api/hr/pto/[id] — delete (pending or denied only)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('id')
    .eq('google_id', user.id)
    .single()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await adminClient
    .from('pto_requests')
    .select('id, status, task_id')
    .eq('id', id)
    .eq('user_id', dbUser.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status === 'approved') {
    return NextResponse.json({ error: 'Approved requests cannot be deleted' }, { status: 400 })
  }

  // Delete linked task
  if (existing.task_id) {
    await adminClient.from('crm_tasks').delete().eq('id', existing.task_id)
  }

  const { error } = await adminClient.from('pto_requests').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
