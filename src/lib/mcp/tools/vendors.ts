import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { McpUser } from '../auth'
import { errorResult, jsonResult } from '../results'
import { CONTACT_FIELDS, TASK_SUMMARY_FIELDS, VENDOR_FIELDS } from '../fields'

export function registerVendorTools(server: McpServer, _user: McpUser) {
  server.registerTool(
    'search_vendors',
    {
      title: 'Search vendors',
      description: 'Find vendors by name. Returns up to 50, sorted by name. Supplier login details are never returned.',
      inputSchema: {
        q: z.string().trim().max(100).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      let q = createAdminClient()
        .from('crm_vendors')
        .select(VENDOR_FIELDS)
        .order('name', { ascending: true })
        .limit(args.limit ?? 20)

      if (args.q) q = q.ilike('name', `%${args.q}%`)

      const { data, error } = await q
      if (error) return errorResult('Could not search vendors.')
      return jsonResult(data ?? [])
    },
  )

  server.registerTool(
    'get_vendor',
    {
      title: 'Get vendor',
      description: 'One vendor with contacts and open tasks (up to 10). Supplier login details are never returned.',
      inputSchema: { id: z.uuid() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const admin = createAdminClient()
      const [vendorRes, contactsRes, tasksRes] = await Promise.all([
        admin.from('crm_vendors').select(VENDOR_FIELDS).eq('id', id).maybeSingle(),
        admin.from('crm_contacts').select(CONTACT_FIELDS).eq('vendor_id', id).is('deleted_at', null).order('last_name'),
        admin
          .from('crm_tasks')
          .select(TASK_SUMMARY_FIELDS)
          .eq('vendor_id', id)
          .neq('status', 'completed')
          .order('due_date', { ascending: true })
          .limit(10),
      ])

      if (vendorRes.error || !vendorRes.data) return errorResult('Vendor not found.')

      return jsonResult({
        vendor: vendorRes.data,
        contacts: contactsRes.data ?? [],
        open_tasks: tasksRes.data ?? [],
      })
    },
  )
}
