import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  // Auth: must be a logged-in admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('is_admin')
    .eq('google_id', user.id)
    .single()
  if (!dbUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // List all Supabase auth users — metadata includes Google profile picture
  const { data: authData, error: authError } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  let synced  = 0
  let skipped = 0

  for (const authUser of authData.users) {
    const meta      = authUser.user_metadata ?? {}
    const avatarUrl = meta.avatar_url || meta.picture || null
    const email     = authUser.email

    if (!avatarUrl || !email) { skipped++; continue }

    const { error } = await adminClient
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('email', email)

    if (!error) synced++
  }

  return NextResponse.json({
    synced,
    skipped,
    total: authData.users.length,
    message: `Updated ${synced} user photo${synced !== 1 ? 's' : ''}.`,
  })
}
