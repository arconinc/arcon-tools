import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { updateTask } from '@/lib/crm/tasks-service'

// GET /api/marketing/tasks/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: task, error } = await adminClient
    .from('crm_tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch all related data in parallel
  const [commentsRes, historyRes, attachmentsRes, oppRes, custRes, vendRes, contRes, assignedUserRes, specRes, teamRes] = await Promise.all([
    adminClient
      .from('crm_task_comments')
      .select('*, crm_comment_attachments(*)')
      .eq('task_id', id)
      .order('created_at', { ascending: true }),
    adminClient
      .from('crm_task_history')
      .select('*')
      .eq('task_id', id)
      .order('changed_at', { ascending: true }),
    adminClient
      .from('crm_task_attachments')
      .select('*')
      .eq('task_id', id)
      .order('created_at', { ascending: true }),
    task.opportunity_id
      ? adminClient.from('crm_opportunities').select('id, name').eq('id', task.opportunity_id).single()
      : Promise.resolve({ data: null }),
    task.customer_id
      ? adminClient.from('crm_customers').select('id, name').eq('id', task.customer_id).single()
      : Promise.resolve({ data: null }),
    task.vendor_id
      ? adminClient.from('crm_vendors').select('id, name').eq('id', task.vendor_id).single()
      : Promise.resolve({ data: null }),
    task.contact_id
      ? adminClient.from('crm_contacts').select('id, first_name, last_name').eq('id', task.contact_id).single()
      : Promise.resolve({ data: null }),
    task.assigned_to
      ? adminClient.from('users').select('id, display_name, email, avatar_url, profile_image_url').eq('id', task.assigned_to).single()
      : Promise.resolve({ data: null }),
    adminClient
      .from('spec_samples')
      .select('id, item_name, status')
      .or(`linked_task_id.eq.${id},artwork_task_id.eq.${id}`)
      .limit(1)
      .maybeSingle(),
    task.team_id
      ? adminClient.from('groups').select('id, name, color').eq('id', task.team_id).single()
      : Promise.resolve({ data: null }),
  ])

  // Resolve created_by, last_worked_by, and delegators to display names
  const peopleIds = [...new Set([
    task.created_by,
    task.last_worked_by,
    ...(task.delegators ?? []),
  ].filter(Boolean))]
  let peopleMap: Record<string, { id: string; display_name: string; email?: string; avatar_url?: string | null; profile_image_url?: string | null }> = {}
  if (peopleIds.length > 0) {
    const { data: people } = await adminClient
      .from('users')
      .select('id, display_name, email, avatar_url, profile_image_url')
      .in('id', peopleIds)
    for (const u of people ?? []) peopleMap[u.id] = u
  }

  const createdUser = task.created_by ? (peopleMap[task.created_by] ?? null) : null
  const lastWorkedUser = task.last_worked_by ? (peopleMap[task.last_worked_by] ?? null) : null
  const delegatorUsers = (task.delegators ?? [])
    .map((uid: string) => peopleMap[uid])
    .filter(Boolean)

  // Enrich comments with user info
  const commentRows = commentsRes.data ?? []
  const commentUserIds = [...new Set(commentRows.map((c: any) => c.user_id).filter(Boolean))]
  const commentUsersMap: Record<string, { display_name: string; email: string; avatar_url: string | null; profile_image_url: string | null }> = {}
  if (commentUserIds.length > 0) {
    const { data: cUsers } = await adminClient
      .from('users')
      .select('id, display_name, email, avatar_url, profile_image_url')
      .in('id', commentUserIds)
    for (const u of cUsers ?? []) commentUsersMap[u.id] = { display_name: u.display_name, email: u.email, avatar_url: u.avatar_url, profile_image_url: u.profile_image_url }
  }

  const enrichedComments = commentRows.map((c: any) => ({
    ...c,
    attachments: c.crm_comment_attachments ?? [],
    user: commentUsersMap[c.user_id] ?? { display_name: 'Unknown' },
  }))

  // Enrich history with user names (and avatar so history actors can be
  // shown in the task-level "involved" avatar stack, not just initials)
  const historyRows = historyRes.data ?? []
  const histUserIds = [...new Set(historyRows.map((h: any) => h.user_id).filter(Boolean))]
  const histUsersMap: Record<string, { display_name: string; avatar_url: string | null; profile_image_url: string | null }> = {}
  if (histUserIds.length > 0) {
    const { data: hUsers } = await adminClient
      .from('users')
      .select('id, display_name, avatar_url, profile_image_url')
      .in('id', histUserIds)
    for (const u of hUsers ?? []) histUsersMap[u.id] = { display_name: u.display_name, avatar_url: u.avatar_url, profile_image_url: u.profile_image_url }
  }

  // Also collect user IDs from assigned_to field changes
  const assignedToUserIds = [...new Set(
    historyRows
      .filter((h: any) => h.field_changed === 'assigned_to')
      .flatMap((h: any) => [h.old_value, h.new_value])
      .filter(Boolean)
  )]
  let assignedUsersMap: Record<string, string> = {}
  if (assignedToUserIds.length > 0) {
    const { data: aUsers } = await adminClient
      .from('users')
      .select('id, display_name')
      .in('id', assignedToUserIds)
    for (const u of aUsers ?? []) assignedUsersMap[u.id] = u.display_name
  }

  // Same resolution for team_id field changes, so a team reassignment reads
  // as "Sales Team" rather than a raw group UUID in the activity thread.
  const teamIdsFromHistory = [...new Set(
    historyRows
      .filter((h: any) => h.field_changed === 'team_id')
      .flatMap((h: any) => [h.old_value, h.new_value])
      .filter(Boolean)
  )]
  const historyTeamsMap: Record<string, string> = {}
  if (teamIdsFromHistory.length > 0) {
    const { data: hTeams } = await adminClient
      .from('groups')
      .select('id, name')
      .in('id', teamIdsFromHistory)
    for (const t of hTeams ?? []) historyTeamsMap[t.id] = t.name
  }

  const enrichedHistory = historyRows.map((h: any) => ({
    ...h,
    user: { id: h.user_id, display_name: histUsersMap[h.user_id]?.display_name ?? 'Unknown', avatar_url: histUsersMap[h.user_id]?.avatar_url ?? null, profile_image_url: histUsersMap[h.user_id]?.profile_image_url ?? null },
    old_value: h.field_changed === 'assigned_to' && h.old_value ? (assignedUsersMap[h.old_value] ?? h.old_value)
      : h.field_changed === 'team_id' && h.old_value ? (historyTeamsMap[h.old_value] ?? h.old_value)
      : h.old_value,
    new_value: h.field_changed === 'assigned_to' && h.new_value ? (assignedUsersMap[h.new_value] ?? h.new_value)
      : h.field_changed === 'team_id' && h.new_value ? (historyTeamsMap[h.new_value] ?? h.new_value)
      : h.new_value,
  }))

  const contact = contRes.data
  return NextResponse.json({
    ...task,
    comments: enrichedComments,
    history: enrichedHistory,
    attachments: attachmentsRes.data ?? [],
    opportunity: oppRes.data ?? null,
    customer: custRes.data ?? null,
    vendor: vendRes.data ?? null,
    contact: contact ? { id: contact.id, first_name: contact.first_name, last_name: contact.last_name } : null,
    assigned_user: assignedUserRes.data ?? null,
    created_user: createdUser,
    last_worked_user: lastWorkedUser,
    delegator_users: delegatorUsers,
    linked_spec: specRes.data ?? null,
    team: teamRes.data ?? null,
  })
}

// PATCH /api/marketing/tasks/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  return updateTask(appUser, id, await req.json())
}

// DELETE /api/marketing/tasks/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()

  // Owners or admins can delete
  const { data: task } = await adminClient
    .from('crm_tasks')
    .select('created_by, task_owner')
    .eq('id', id)
    .single()

  if (task && !appUser.is_admin && task.created_by !== appUser.id && task.task_owner !== appUser.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await adminClient.from('crm_tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
