import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/roles — list all roles (any authenticated user; read-only)
// Used by the access request form to populate the role selector.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('groups')
    .select('id, key, name, description, color, group_capabilities!inner(capability)')
    .eq('is_active', true)
    .eq('group_capabilities.capability', 'access_control')
    .order('name')

  return NextResponse.json((data ?? []).map((group) => ({
    id: group.id,
    name: group.key,
    label: group.name,
    description: group.description,
    color: group.color,
  })))
}
