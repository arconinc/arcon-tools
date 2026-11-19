import { z } from 'zod'

// Input shapes for the task tools. Kept apart from the tool handlers so they can be unit tested.
// Fields not listed here are dropped by zod, so MCP callers cannot set store_id, sort_order, or task_owner.

export const TASK_STATUSES = [
  'not_started',
  'in_progress',
  'completed',
  'waiting_on_approval',
  'waiting_on_client_approval',
  'need_changes',
] as const

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')

// Shared by create_task and update_task. Create makes these optional, and update makes them optional too.
const taskFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable(),
  assigned_to: z.uuid().nullable(),
  team_id: z.uuid().nullable(),
  category: z.string().max(100).nullable(),
  priority: z.enum(TASK_PRIORITIES),
  due_date: dateString.nullable(),
  status: z.enum(TASK_STATUSES),
  progress: z.number().int().min(0).max(100),
  customer_id: z.uuid().nullable(),
  vendor_id: z.uuid().nullable(),
  opportunity_id: z.uuid().nullable(),
  contact_id: z.uuid().nullable(),
}

export const createTaskShape = {
  title: taskFields.title,
  description: taskFields.description.optional(),
  assigned_to: taskFields.assigned_to.optional(),
  team_id: taskFields.team_id.optional(),
  category: taskFields.category.optional(),
  priority: taskFields.priority.optional(),
  due_date: taskFields.due_date.optional(),
  status: taskFields.status.optional(),
  customer_id: taskFields.customer_id.optional(),
  vendor_id: taskFields.vendor_id.optional(),
  opportunity_id: taskFields.opportunity_id.optional(),
  contact_id: taskFields.contact_id.optional(),
}

export const updateTaskShape = {
  id: z.uuid(),
  title: taskFields.title.optional(),
  description: taskFields.description.optional(),
  assigned_to: taskFields.assigned_to.optional(),
  team_id: taskFields.team_id.optional(),
  category: taskFields.category.optional(),
  priority: taskFields.priority.optional(),
  due_date: taskFields.due_date.optional(),
  status: taskFields.status.optional(),
  progress: taskFields.progress.optional(),
  customer_id: taskFields.customer_id.optional(),
  vendor_id: taskFields.vendor_id.optional(),
  opportunity_id: taskFields.opportunity_id.optional(),
  contact_id: taskFields.contact_id.optional(),
}

export const listTasksShape = {
  assignee: z.string().max(64).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  customer_id: z.uuid().optional(),
  vendor_id: z.uuid().optional(),
  opportunity_id: z.uuid().optional(),
  include_completed: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
}

export const addTaskCommentShape = {
  task_id: z.uuid(),
  comment: z.string().trim().min(1).max(5000),
  parent_comment_id: z.uuid().optional(),
}

// Drops keys whose value is undefined, so an omitted field never reaches the write path as null.
export function definedOnly<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<T>
}
