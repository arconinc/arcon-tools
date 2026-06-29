import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, forbidden, badRequest, notFound, serverError, ok } from '@/lib/api/respond'
import { stripReadOnly } from '@/lib/api/sanitize'
import { setEntityTags } from '@/lib/crm/tags'
import { OPPORTUNITY_OWNERS_GROUP_KEY } from '@/lib/groups/constants'

// Fields that trigger a stage history row on change
const TRACKED_FIELDS = ['pipeline_stage', 'status', 'value', 'probability', 'forecast_close_date'] as const

async function validateOpportunityOwner(adminClient: ReturnType<typeof createAdminClient>, assignedTo: unknown) {
  if (typeof assignedTo !== 'string' || assignedTo.trim() === '') {
    return { valid: false, error: null }
  }

  const { data, error } = await adminClient
    .from('group_memberships')
    .select('id, groups!group_memberships_group_id_fkey!inner(key, is_active), users!group_memberships_user_id_fkey!inner(id, deactivated_at)')
    .eq('user_id', assignedTo)
    .eq('groups.key', OPPORTUNITY_OWNERS_GROUP_KEY)
    .eq('groups.is_active', true)
    .is('users.deactivated_at', null)
    .maybeSingle()

  if (error) return { valid: false, error: error.message }
  return { valid: Boolean(data), error: null }
}

// GET /api/marketing/opportunities/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: opp, error } = await adminClient
    .from('crm_opportunities')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !opp) return notFound('Opportunity not found')

  // Fetch related data in parallel
  const [customerRes, assignedUserRes, tasksRes, historyRes, filesRes, entityTagsRes] = await Promise.all([
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
    adminClient
      .from('crm_entity_tags')
      .select('crm_tags(id, name, color)')
      .eq('entity_type', 'opportunity')
      .eq('entity_id', id),
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

  const tags = (entityTagsRes.data ?? []).map((r: any) => r.crm_tags).filter(Boolean)

  return ok({
    ...opp,
    customer: customerRes.data ?? null,
    assigned_user: assignedUserRes.data ?? null,
    tasks: tasksRes.data ?? [],
    stage_history: enrichedHistory,
    files: filesRes.data ?? [],
    tags,
  })
}

// PATCH /api/marketing/opportunities/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { id } = await params
  const body = await req.json()

  // Extract tag_ids and strip read-only fields + related arrays
  const { tag_ids, ...rest } = body
  const updates = stripReadOnly(rest, ['tags', 'customer', 'assigned_user', 'tasks', 'stage_history', 'files', 'customer_name', 'assigned_user_name'])

  const adminClient = createAdminClient()

  // Fetch current record for stage history comparison
  const { data: current, error: fetchErr } = await adminClient
    .from('crm_opportunities')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !current) return notFound('Opportunity not found')

  if ('assigned_to' in updates && updates.assigned_to !== current.assigned_to && updates.assigned_to != null) {
    const { valid, error } = await validateOpportunityOwner(adminClient, updates.assigned_to)
    if (error) return serverError(error)
    if (!valid) return badRequest('assigned_to must be an active Opportunity Owner')
  }

  // Handle tag updates after validation so rejected owner changes have no side effects.
  if (Array.isArray(tag_ids)) {
    await setEntityTags(adminClient, 'opportunity', id, tag_ids)
    // If only updating tags, return early
    if (Object.keys(updates).length === 0) {
      return ok({ ok: true })
    }
  }

  // Determine which tracked fields changed
  const changedFields = TRACKED_FIELDS.filter(
    (field) => field in updates && updates[field] !== current[field]
  )

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
    finalUpdates.closed_at = null
  }

  const { data, error } = await adminClient
    .from('crm_opportunities')
    .update(finalUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) return serverError(error.message)
  return ok(data)
}

// DELETE /api/marketing/opportunities/[id] — admin only
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()
  if (!appUser.is_admin) return forbidden()

  const { id } = await params
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('crm_opportunities').delete().eq('id', id)

  if (error) return serverError(error.message)
  return ok({ ok: true })
}
