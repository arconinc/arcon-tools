import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { McpUser } from '../auth'
import { errorResult, jsonResult } from '../results'

export function registerPeopleTools(server: McpServer, _user: McpUser) {
  server.registerTool(
    'list_users',
    {
      title: 'List users',
      description: 'Active employees: id, display_name, email, department. Use the id when assigning tasks.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      const { data, error } = await createAdminClient()
        .from('users')
        .select('id, display_name, email, department')
        .is('deactivated_at', null)
        .order('display_name', { ascending: true })
      if (error) return errorResult('Could not load users.')
      return jsonResult(data ?? [])
    },
  )

  server.registerTool(
    'list_teams',
    {
      title: 'List teams',
      description: 'Active assignment teams (groups): id, key, name. Use the id as a task team_id.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      const { data, error } = await createAdminClient()
        .from('groups')
        .select('id, key, name, color, group_capabilities!inner(capability)')
        .eq('is_active', true)
        .eq('group_capabilities.capability', 'assignment_pool')
        .order('sort_order')
        .order('name')
      if (error) return errorResult('Could not load teams.')
      return jsonResult((data ?? []).map(({ id, key, name, color }) => ({ id, key, name, color })))
    },
  )
}
