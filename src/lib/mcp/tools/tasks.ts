import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createTask, updateTask, addTaskComment } from '@/lib/crm/tasks-service'
import type { McpUser } from '../auth'
import { errorResult, jsonResult, fromRouteResponse } from '../results'
import { addTaskCommentShape, createTaskShape, definedOnly, listTasksShape, updateTaskShape } from '../schemas'

async function userNames(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return {}
  const { data } = await createAdminClient().from('users').select('id, display_name').in('id', unique)
  return Object.fromEntries((data ?? []).map((u) => [u.id, u.display_name]))
}

export function registerTaskTools(server: McpServer, user: McpUser) {
  server.registerTool(
    'list_tasks',
    {
      title: 'List tasks',
      description:
        "CRM tasks, most recently updated first. Defaults to tasks assigned to you. Completed tasks are hidden unless include_completed is true or a status is given. assignee: 'me' (default), 'all', or a user id from list_users.",
      inputSchema: listTasksShape,
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const assignee = args.assignee ?? 'me'
      let q = createAdminClient()
        .from('crm_tasks')
        .select('id, title, status, priority, due_date, assigned_to, team_id, customer_id, vendor_id, opportunity_id, updated_at')
        .order('updated_at', { ascending: false })
        .limit(args.limit ?? 25)

      if (assignee === 'me') q = q.eq('assigned_to', user.id)
      else if (assignee !== 'all') q = q.eq('assigned_to', assignee)

      if (args.status) q = q.eq('status', args.status)
      else if (!args.include_completed) q = q.neq('status', 'completed')
      if (args.priority) q = q.eq('priority', args.priority)
      if (args.customer_id) q = q.eq('customer_id', args.customer_id)
      if (args.vendor_id) q = q.eq('vendor_id', args.vendor_id)
      if (args.opportunity_id) q = q.eq('opportunity_id', args.opportunity_id)

      const { data, error } = await q
      if (error) return errorResult('Could not load tasks. Check the assignee id.')
      return jsonResult(data ?? [])
    },
  )

  server.registerTool(
    'get_task',
    {
      title: 'Get task',
      description: 'One task with its comments and the 50 most recent field changes.',
      inputSchema: { id: z.uuid() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const admin = createAdminClient()
      const [taskRes, commentsRes, historyRes] = await Promise.all([
        admin.from('crm_tasks').select('*').eq('id', id).maybeSingle(),
        admin
          .from('crm_task_comments')
          .select('id, user_id, comment, parent_comment_id, created_at')
          .eq('task_id', id)
          .order('created_at', { ascending: true }),
        admin
          .from('crm_task_history')
          .select('field_changed, old_value, new_value, user_id, changed_at')
          .eq('task_id', id)
          .order('changed_at', { ascending: false })
          .limit(50),
      ])

      if (taskRes.error || !taskRes.data) return errorResult('Task not found.')

      const comments = commentsRes.data ?? []
      const history = historyRes.data ?? []
      const names = await userNames([
        ...comments.map((c) => c.user_id),
        ...history.map((h) => h.user_id),
      ])

      return jsonResult({
        task: taskRes.data,
        comments: comments.map((c) => ({ ...c, author: names[c.user_id] ?? 'Unknown' })),
        history: history.map((h) => ({ ...h, changed_by: names[h.user_id] ?? 'Unknown' })),
      })
    },
  )

  server.registerTool(
    'create_task',
    {
      title: 'Create task',
      description:
        'Create a CRM task. Unassigned fields default to you as the assignee. Set assigned_to to another user id, or team_id to hand it to a team.',
      inputSchema: createTaskShape,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => fromRouteResponse(await createTask(user, definedOnly(args))),
  )

  server.registerTool(
    'update_task',
    {
      title: 'Update task',
      description:
        'Update fields on a task. Only the fields you pass change. Pass null to clear a link or assignee. Status, assignee, and team changes trigger the usual notifications and history.',
      inputSchema: updateTaskShape,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ id, ...fields }) => {
      const changes = definedOnly(fields)
      if (Object.keys(changes).length === 0) return errorResult('No fields to update.')
      return fromRouteResponse(await updateTask(user, id, changes))
    },
  )

  server.registerTool(
    'add_task_comment',
    {
      title: 'Add task comment',
      description: 'Post a comment on a task. Notifies the task creator and assignee, except you.',
      inputSchema: addTaskCommentShape,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ task_id, comment, parent_comment_id }) =>
      fromRouteResponse(await addTaskComment(user, task_id, definedOnly({ comment, parent_comment_id }))),
  )
}
