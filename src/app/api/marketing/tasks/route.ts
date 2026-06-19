import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { DEPARTMENTS, DEPARTMENT_CATEGORIES, getDepartmentForTaskCategory } from '@/lib/task-constants'
import type { CrmTaskDepartment } from '@/types'
import { dispatchNotification, fetchActor } from '@/lib/notifications/dispatch'
import { taskAssigned } from '@/lib/notifications/registry'
import { unauthorized, badRequest, serverError, created, ok } from '@/lib/api/respond'
import { stripReadOnly } from '@/lib/api/sanitize'

function quotePostgrestValue(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`
}

function normalizeTaskAssignment(task: Record<string, unknown>) {
  const normalized = { ...task }

  if (
    typeof normalized.department === 'string' &&
    normalized.department &&
    !(DEPARTMENTS as string[]).includes(normalized.department)
  ) {
    return { error: 'Invalid department' }
  }

  if (typeof normalized.category === 'string' && normalized.category) {
    const categoryDepartment = getDepartmentForTaskCategory(normalized.category)
    if (!categoryDepartment) {
      normalized.category = null
    } else {
      if (normalized.department && normalized.department !== categoryDepartment) {
        return { error: 'Category does not belong to selected department' }
      }
      normalized.department = categoryDepartment
    }
  }

  return { task: normalized }
}

// GET /api/marketing/tasks
// ?assigned_to=me|all|<uuid>|<uuid1>,<uuid2>  ?status=  ?category=  ?department=  ?delegated_by_me=true  ?due_before=  ?opportunity_id=  ?customer_id=  ?vendor_id=  ?order_by=created|due_date|sort_order  ?page=1&limit=50
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { searchParams } = new URL(req.url)
  const assignedTo = searchParams.get('assigned_to')
  const status = searchParams.get('status')
  const category = searchParams.get('category')
  const department = searchParams.get('department')
  const delegatedByMe = searchParams.get('delegated_by_me') === 'true'
  const hideCompleted = searchParams.get('hide_completed') === 'true'
  const dueBefore = searchParams.get('due_before')
  const opportunityId = searchParams.get('opportunity_id')
  const customerId = searchParams.get('customer_id')
  const vendorId = searchParams.get('vendor_id')
  const orderBy = searchParams.get('order_by') ?? 'sort_order'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const from = (page - 1) * limit
  const to = from + limit - 1

  const adminClient = createAdminClient()

  // Resolve assigned_to into a list of user IDs (null = no filter / all users)
  let assignedToIds: string[] | null = null
  if (assignedTo && assignedTo !== 'all') {
    if (assignedTo === 'me') {
      assignedToIds = [appUser.id]
    } else {
      assignedToIds = assignedTo.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }

  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const applyFilters = (q: any) => {
    if (hideCompleted) {
      q = q.neq('status', 'completed')
    } else {
      // Always hide completed tasks that were last updated more than 2 weeks ago
      q = q.or(`status.neq.completed,updated_at.gte.${twoWeeksAgo}`)
    }
    if (delegatedByMe) {
      // Show tasks where current user created, owns, or delegated the task
      q = q.or(`created_by.eq.${appUser.id},task_owner.eq.${appUser.id},delegators.cs.{${appUser.id}}`)
      // Also apply assigned_to filter if specified
      if (assignedToIds) {
        if (assignedToIds.length === 1) {
          q = q.eq('assigned_to', assignedToIds[0])
        } else {
          q = q.in('assigned_to', assignedToIds)
        }
      }
    } else if (assignedToIds) {
      if (assignedToIds.length === 1) {
        q = q.eq('assigned_to', assignedToIds[0])
      } else {
        q = q.in('assigned_to', assignedToIds)
      }
    }
    if (category) {
      q = q.eq('category', category)
    } else if (department) {
      const departmentCategories = DEPARTMENT_CATEGORIES[department as CrmTaskDepartment] ?? []
      if (departmentCategories.length > 0) {
        q = q.or(`department.eq.${quotePostgrestValue(department)},category.in.(${departmentCategories.map(quotePostgrestValue).join(',')})`)
      } else {
        q = q.eq('department', department)
      }
    }
    if (status) {
      const statuses = status.split(',').map((s) => s.trim()).filter(Boolean)
      if (statuses.length === 1) {
        q = q.eq('status', statuses[0])
      } else if (statuses.length > 1) {
        q = q.in('status', statuses)
      }
    }
    if (dueBefore) q = q.lte('due_date', dueBefore)
    if (opportunityId) q = q.eq('opportunity_id', opportunityId)
    if (customerId) q = q.eq('customer_id', customerId)
    if (vendorId) q = q.eq('vendor_id', vendorId)
    return q
  }

  const [countRes, dataRes] = await Promise.all([
    applyFilters(adminClient.from('crm_tasks').select('*', { count: 'exact', head: true })),
    applyFilters(
      adminClient
        .from('crm_tasks')
        .select('id, title, assigned_to, task_owner, department, category, priority, due_date, status, progress, delegators, opportunity_id, customer_id, vendor_id, contact_id, sort_order, created_by, created_at, updated_at')
        .order(orderBy === 'created' ? 'created_at' : orderBy === 'due_date' ? 'due_date' : 'sort_order', { ascending: orderBy === 'created' ? false : true, nullsFirst: false })
        .order(orderBy === 'created' ? 'due_date' : orderBy === 'due_date' ? 'sort_order' : 'due_date', { ascending: true, nullsFirst: false })
    ).range(from, to),
  ])

  if (dataRes.error) return serverError(dataRes.error.message)

  const total = countRes.count ?? 0
  const rows = (dataRes.data as any[]) ?? []

  // Batch-enrich: user names for assigned_to
  const userIds = [...new Set(rows.map((t: any) => t.assigned_to).filter(Boolean))]
  const oppIds = [...new Set(rows.map((t: any) => t.opportunity_id).filter(Boolean))]
  const custIds = [...new Set(rows.map((t: any) => t.customer_id).filter(Boolean))]
  const vendIds = [...new Set(rows.map((t: any) => t.vendor_id).filter(Boolean))]
  const contIds = [...new Set(rows.map((t: any) => t.contact_id).filter(Boolean))]

  const [usersRes, oppsRes, custsRes, vendsRes, contsRes] = await Promise.all([
    userIds.length > 0
      ? adminClient.from('users').select('id, display_name').in('id', userIds)
      : Promise.resolve({ data: [] }),
    oppIds.length > 0
      ? adminClient.from('crm_opportunities').select('id, name').in('id', oppIds)
      : Promise.resolve({ data: [] }),
    custIds.length > 0
      ? adminClient.from('crm_customers').select('id, name').in('id', custIds)
      : Promise.resolve({ data: [] }),
    vendIds.length > 0
      ? adminClient.from('crm_vendors').select('id, name').in('id', vendIds)
      : Promise.resolve({ data: [] }),
    contIds.length > 0
      ? adminClient.from('crm_contacts').select('id, first_name, last_name').in('id', contIds)
      : Promise.resolve({ data: [] }),
  ])

  const usersMap: Record<string, string> = {}
  for (const u of usersRes.data ?? []) usersMap[u.id] = u.display_name
  const oppsMap: Record<string, string> = {}
  for (const o of oppsRes.data ?? []) oppsMap[o.id] = o.name
  const custsMap: Record<string, string> = {}
  for (const c of custsRes.data ?? []) custsMap[c.id] = c.name
  const vendsMap: Record<string, string> = {}
  for (const v of vendsRes.data ?? []) vendsMap[v.id] = v.name
  const contsMap: Record<string, string> = {}
  for (const c of contsRes.data ?? []) contsMap[c.id] = `${c.first_name} ${c.last_name}`

  const enriched = rows.map((t: any) => ({
    ...t,
    assigned_user_name: t.assigned_to ? (usersMap[t.assigned_to] ?? null) : null,
    linked_to_name: t.opportunity_id
      ? oppsMap[t.opportunity_id] ?? null
      : t.customer_id
      ? custsMap[t.customer_id] ?? null
      : t.vendor_id
      ? vendsMap[t.vendor_id] ?? null
      : t.contact_id
      ? contsMap[t.contact_id] ?? null
      : null,
    linked_to_type: t.opportunity_id
      ? 'opportunity'
      : t.customer_id
      ? 'customer'
      : t.vendor_id
      ? 'vendor'
      : t.contact_id
      ? 'contact'
      : null,
  }))

  return ok({ tasks: enriched, total, page, limit })
}

// POST /api/marketing/tasks
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const body = await req.json()
  const { title, ...rest } = body
  if (!title?.trim()) return badRequest('Title is required')

  const safeRest = stripReadOnly(rest, ['assigned_user_name', 'linked_to_name', 'linked_to_type'])

  const normalized = normalizeTaskAssignment(safeRest)
  if ('error' in normalized) return badRequest(normalized.error)

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_tasks')
    .insert({
      title: title.trim(),
      ...normalized.task,
      created_by: appUser.id,
      task_owner: normalized.task.task_owner ?? appUser.id,
      assigned_to: normalized.task.assigned_to ?? appUser.id,
      status: normalized.task.status ?? 'not_started',
      priority: normalized.task.priority ?? 'medium',
      progress: normalized.task.progress ?? 0,
    })
    .select()
    .single()

  if (error) return serverError(error.message)

  // Fire task_assigned notification. Wrapped in try/catch so a notification
  // failure (or missing migration) never blocks the task creation response.
  try {
    const isUserAssigned = !!data.assigned_to && data.assigned_to !== appUser.id
    const isDeptOnly = !data.assigned_to && !!data.department
    if (isUserAssigned || isDeptOnly) {
      const actor = await fetchActor(appUser.id)
      await dispatchNotification({
        definition: taskAssigned,
        payload: {
          task_id: data.id,
          task_title: data.title,
          actor_id: appUser.id,
          actor_name: actor.display_name,
          department: isDeptOnly ? data.department : (data.department ?? null),
          due_date: data.due_date ?? null,
          priority: data.priority ?? null,
          status: data.status ?? null,
          description: data.description ?? null,
          fanout_kind: isDeptOnly ? 'department' : 'user',
        },
        recipientSpec: isDeptOnly
          ? { department: data.department }
          : { userId: data.assigned_to },
        suppressUserIds: [appUser.id],
      })
    }
  } catch (err) {
    console.error('[notifications] task POST dispatch failed:', err)
  }

  return created(data)
}
