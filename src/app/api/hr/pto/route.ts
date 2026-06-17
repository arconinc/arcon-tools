import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { ptoSubmitted } from '@/lib/notifications/registry'
import { PtoReason, PTO_REASON_LABELS } from '@/types'

// GET /api/hr/pto — list the current user's own PTO requests
export async function GET() {
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

  const { data, error } = await adminClient
    .from('pto_requests')
    .select('*, reviewer:reviewed_by(display_name)')
    .eq('user_id', dbUser.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ requests: data ?? [] })
}

// POST /api/hr/pto — submit a new PTO request
export async function POST(req: NextRequest) {
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

  const { data: request, error: insertError } = await adminClient
    .from('pto_requests')
    .insert({
      user_id: dbUser.id,
      start_date,
      end_date,
      start_half_day,
      end_half_day,
      reason,
      notes: notes ?? null,
      signed_name: signed_name.trim(),
      signed_at: new Date().toISOString(),
      status: 'pending',
    })
    .select()
    .single()

  if (insertError || !request) {
    return NextResponse.json({ error: insertError?.message ?? 'Insert failed' }, { status: 500 })
  }

  // Create HR task
  const taskTitle = `PTO Request: ${dbUser.display_name} (${start_date} – ${end_date})`
  const reasonLabel = PTO_REASON_LABELS[reason as PtoReason] ?? reason
  const { data: task } = await adminClient
    .from('crm_tasks')
    .insert({
      title: taskTitle,
      department: 'HR',
      status: 'not_started',
      priority: 'medium',
      progress: 0,
      created_by: dbUser.id,
      assigned_to: null,
      description: `Reason: ${reasonLabel}${notes ? `\n\n${notes}` : ''}`,
    })
    .select('id')
    .single()

  if (task) {
    await adminClient
      .from('pto_requests')
      .update({ task_id: task.id })
      .eq('id', request.id)
  }

  // Notify HR department
  await dispatchNotification({
    definition: ptoSubmitted,
    payload: {
      request_id: request.id,
      requester_name: dbUser.display_name,
      start_date,
      end_date,
      reason: reasonLabel,
    },
    recipientSpec: { department: 'HR' },
    suppressUserIds: [dbUser.id],
  })

  return NextResponse.json({ request: { ...request, task_id: task?.id ?? null } }, { status: 201 })
}
