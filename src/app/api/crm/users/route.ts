import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/crm/users — list all users for dropdown use
export async function GET() {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await createAdminClient()
    .from('users')
    .select('id, display_name, email')
    .order('display_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
