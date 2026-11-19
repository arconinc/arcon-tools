import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { McpUser } from '../auth'
import { errorResult, jsonResult } from '../results'
import { CONTACT_FIELDS, CUSTOMER_FIELDS, OPPORTUNITY_FIELDS, TASK_SUMMARY_FIELDS } from '../fields'

export function registerCustomerTools(server: McpServer, _user: McpUser) {
  server.registerTool(
    'search_customers',
    {
      title: 'Search customers',
      description: 'Find CRM customers by name. Optional filters: client_status, assigned_to. Returns up to 50, sorted by name.',
      inputSchema: {
        q: z.string().trim().max(100).optional(),
        client_status: z.enum(['Prospective', 'Active', 'Former']).optional(),
        assigned_to: z.uuid().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      let q = createAdminClient()
        .from('crm_customers')
        .select(CUSTOMER_FIELDS)
        .is('deleted_at', null)
        .order('name', { ascending: true })
        .limit(args.limit ?? 20)

      if (args.q) q = q.ilike('name', `%${args.q}%`)
      if (args.client_status) q = q.eq('client_status', args.client_status)
      if (args.assigned_to) q = q.eq('assigned_to', args.assigned_to)

      const { data, error } = await q
      if (error) return errorResult('Could not search customers.')
      return jsonResult(data ?? [])
    },
  )

  server.registerTool(
    'get_customer',
    {
      title: 'Get customer',
      description: 'One customer with contacts, opportunities (up to 25), and open tasks (up to 10).',
      inputSchema: { id: z.uuid() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const admin = createAdminClient()
      const [customerRes, contactsRes, oppsRes, tasksRes] = await Promise.all([
        admin.from('crm_customers').select(CUSTOMER_FIELDS).eq('id', id).is('deleted_at', null).maybeSingle(),
        admin.from('crm_contacts').select(CONTACT_FIELDS).eq('customer_id', id).is('deleted_at', null).order('last_name'),
        admin
          .from('crm_opportunities')
          .select(OPPORTUNITY_FIELDS)
          .eq('customer_id', id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(25),
        admin
          .from('crm_tasks')
          .select(TASK_SUMMARY_FIELDS)
          .eq('customer_id', id)
          .neq('status', 'completed')
          .order('due_date', { ascending: true })
          .limit(10),
      ])

      if (customerRes.error || !customerRes.data) return errorResult('Customer not found.')

      return jsonResult({
        customer: customerRes.data,
        contacts: contactsRes.data ?? [],
        opportunities: oppsRes.data ?? [],
        open_tasks: tasksRes.data ?? [],
      })
    },
  )
}
