import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('users')
    .select('id, display_name')
    .contains('department', ['Sales'])
    .is('deactivated_at', null)
    .order('display_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
