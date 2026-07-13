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

  // ponytail: migrate legacy 'General' → 'Order Management' from pre-rename DB rows
  if (normalized.department === 'General') normalized.department = 'Order Management'

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
  const columnStatus = searchParams.get('column_status')
  const category = searchParams.get('category')
  const department = searchParams.get('department')
  const titleSearch = searchParams.get('title_search')?.trim()
  const assignmentSearch = searchParams.get('assignment_search')?.trim()
  const priority = searchParams.get('priority')
  const columnAssignedTo = searchParams.get('column_assigned_to')
  const createdBy = searchParams.get('created_by')
  const linkedType = searchParams.get('linked_type')
  const linkedSearch = searchParams.get('linked_search')?.trim()
  const delegatedByMe = searchParams.get('delegated_by_me') === 'true'
  const hideCompleted = searchParams.get('hide_completed') === 'true'
  const dueBefore = searchParams.get('due_before')
  const dueFrom = searchParams.get('due_from')
  const dueTo = searchParams.get('due_to')
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

  const columnAssignedToIds = columnAssignedTo?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
  const createdByIds = createdBy?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
  const priorityValues = priority?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
  const columnStatusValues = columnStatus?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
  const linkedTypeValues = linkedType?.split(',').map((s) => s.trim()).filter(Boolean) ?? []

  const linkedTypeColumns = linkedTypeValues
    .map((type) => ({ opportunity: 'opportunity_id', customer: 'customer_id', vendor: 'vendor_id', contact: 'contact_id' }[type]))
    .filter(Boolean) as string[]

  let linkedSearchFilters: string[] = []
  if (linkedSearch) {
    const like = `%${linkedSearch}%`
    const [oppsRes, custsRes, vendsRes, contsRes] = await Promise.all([
      adminClient.from('crm_opportunities').select('id').ilike('name', like).limit(100),
      adminClient.from('crm_customers').select('id').ilike('name', like).limit(100),
      adminClient.from('crm_vendors').select('id').ilike('name', like).limit(100),
      adminClient.from('crm_contacts').select('id').or(`first_name.ilike.${quotePostgrestValue(like)},last_name.ilike.${quotePostgrestValue(like)}`).limit(100),
    ])
    linkedSearchFilters = [
      ...((oppsRes.data ?? []).map((row: { id: string }) => `opportunity_id.eq.${row.id}`)),
      ...((custsRes.data ?? []).map((row: { id: string }) => `customer_id.eq.${row.id}`)),
      ...((vendsRes.data ?? []).map((row: { id: string }) => `vendor_id.eq.${row.id}`)),
      ...((contsRes.data ?? []).map((row: { id: string }) => `contact_id.eq.${row.id}`)),
    ]
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
    if (titleSearch) q = q.ilike('title', `%${titleSearch}%`)
    if (assignmentSearch) {
      const value = quotePostgrestValue(`%${assignmentSearch}%`)
      q = q.or(`department.ilike.${value},category.ilike.${value}`)
    }
    if (priorityValues.length === 1) q = q.eq('priority', priorityValues[0])
    else if (priorityValues.length > 1) q = q.in('priority', priorityValues)
    if (status) {
      const statuses = status.split(',').map((s) => s.trim()).filter(Boolean)
      if (statuses.length === 1) {
        q = q.eq('status', statuses[0])
      } else if (statuses.length > 1) {
        q = q.in('status', statuses)
      }
    }
    if (columnStatusValues.length === 1) q = q.eq('status', columnStatusValues[0])
    else if (columnStatusValues.length > 1) q = q.in('status', columnStatusValues)
    if (dueBefore) q = q.lte('due_date', dueBefore)
    if (dueFrom) q = q.gte('due_date', dueFrom)
    if (dueTo) q = q.lte('due_date', dueTo)
    if (columnAssignedToIds.length === 1) q = q.eq('assigned_to', columnAssignedToIds[0])
    else if (columnAssignedToIds.length > 1) q = q.in('assigned_to', columnAssignedToIds)
    if (createdByIds.length === 1) q = q.eq('created_by', createdByIds[0])
    else if (createdByIds.length > 1) q = q.in('created_by', createdByIds)
    if (linkedTypeColumns.length === 1) q = q.not(linkedTypeColumns[0], 'is', null)
    else if (linkedTypeColumns.length > 1) q = q.or(linkedTypeColumns.map((column) => `${column}.not.is.null`).join(','))
    if (linkedSearch) {
      if (linkedSearchFilters.length === 0) q = q.eq('id', '00000000-0000-0000-0000-000000000000')
      else q = q.or(linkedSearchFilters.join(','))
    }
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

  // Batch-enrich: user names for assigned_to and created_by
  const userIds = [...new Set([
    ...rows.map((t: any) => t.assigned_to),
    ...rows.map((t: any) => t.created_by),
  ].filter(Boolean))]
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
    created_by_name: t.created_by ? (usersMap[t.created_by] ?? null) : null,
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
