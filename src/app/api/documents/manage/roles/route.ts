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
  const { data, error } = await adminClient.from('roles').select('id, name, label, color').order('label')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ roles: data })
}
