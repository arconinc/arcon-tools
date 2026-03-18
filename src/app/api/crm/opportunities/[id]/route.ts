import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// Fields that trigger a stage history row on change
const TRACKED_FIELDS = ['pipeline_stage', 'status', 'value', 'probability', 'forecast_close_date'] as const

// GET /api/crm/opportunities/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: opp, error } = await adminClient
    .from('crm_opportunities')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !opp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch related data in parallel
  const today = new Date().toISOString()
  const [customerRes, assignedUserRes, tasksRes, historyRes, filesRes] = await Promise.all([
    adminClient.from('crm_customers').select('id, name').eq('id', opp.customer_id).single(),
    opp.assigned_to
      ? adminClient.from('users').select('id, display_name, email').eq('id', opp.assigned_to).single()
      : Promise.resolve({ data: null }),
    adminClient
      .from('crm_tasks')
      .select('id, title, status, priority, due_date, category, assigned_to')
      .eq('opportunity_id', id)
      .neq('status', 'completed')
      .order('due_date', { ascending: true })
      .limit(10),
    adminClient
      .from('crm_opportunity_stage_history')
      .select('*')
      .eq('opportunity_id', id)
      .order('changed_at', { ascending: false }),
    adminClient
      .from('crm_files')
      .select('id, label, url, created_at')
      .eq('opportunity_id', id)
      .order('created_at', { ascending: false }),
  ])

  // Enrich history with changed_by user names
  const historyRows = historyRes.data ?? []
  const historyUserIds = [...new Set(historyRows.map((h: any) => h.changed_by).filter(Boolean))]
  let historyUsersMap: Record<string, string> = {}
  if (historyUserIds.length > 0) {
    const { data: hUsers } = await adminClient
      .from('users')
      .select('id, display_name')
      .in('id', historyUserIds)
    for (const u of hUsers ?? []) historyUsersMap[u.id] = u.display_name
  }

  const enrichedHistory = historyRows.map((h: any) => ({
    ...h,
    changed_by_name: historyUsersMap[h.changed_by] ?? null,
  }))

  return NextResponse.json({
    ...opp,
    customer: customerRes.data ?? null,
    assigned_user: assignedUserRes.data ?? null,
    tasks: tasksRes.data ?? [],
    stage_history: enrichedHistory,
    files: filesRes.data ?? [],
  })
}

// PATCH /api/crm/opportunities/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Strip read-only fields
  const { id: _id, created_at: _ca, created_by: _cb, ...updates } = body

  const adminClient = createAdminClient()

  // Fetch current record for stage history comparison
  const { data: current, error: fetchErr } = await adminClient
    .from('crm_opportunities')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Determine which tracked fields changed
  const changedFields = TRACKED_FIELDS.filter(
    (field) => field in updates && updates[field] !== current[field]
  )

  // Insert stage history row if any tracked field changed
  if (changedFields.length > 0) {
    await adminClient.from('crm_opportunity_stage_history').insert({
      opportunity_id: id,
      pipeline_stage: current.pipeline_stage,
      status: current.status,
      value: current.value,
      probability: current.probability,
      forecast_close_date: current.forecast_close_date,
      changed_by: appUser.id,
      changed_at: new Date().toISOString(),
    })
  }

  // Auto-set closed_at when status moves to won or lost
  const newStatus = updates.status
  const finalUpdates: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  }

  if (newStatus === 'won' || newStatus === 'lost') {
    if (!current.closed_at) {
      finalUpdates.closed_at = new Date().toISOString()
    }
  } else if (newStatus === 'open' || newStatus === 'stalled') {
    // Re-opening: clear closed_at
    finalUpdates.closed_at = null
  }

  const { data, error } = await adminClient
    .from('crm_opportunities')
    .update(finalUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/crm/opportunities/[id] — admin only
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!appUser.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('crm_opportunities').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
