import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAddonUser } from '../auth'

// GET /api/addon/users
// Returns the user list for the assignee dropdown in the Gmail Add-On.
export async function GET(req: NextRequest) {
  const addonUser = await requireAddonUser(req)
  if (!addonUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('users')
    .select('id, display_name, email')
    .order('display_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ users: data ?? [], currentUserId: addonUser.id })
}
