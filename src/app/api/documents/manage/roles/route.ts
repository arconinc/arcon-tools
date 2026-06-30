import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/documents/manage/roles
// Returns all roles — available to any authenticated user who can manage at least one section.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('groups')
    .select('id, key, name, color, group_capabilities!inner(capability)')
    .eq('is_active', true)
    .eq('group_capabilities.capability', 'access_control')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ roles: (data ?? []).map((group) => ({ id: group.id, name: group.key, label: group.name, color: group.color })) })
}
