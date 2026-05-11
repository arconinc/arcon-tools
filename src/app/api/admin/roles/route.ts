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
    .from('roles')
    .select('id, name, label, description, color')
    .order('label')

  return NextResponse.json(data ?? [])
}
