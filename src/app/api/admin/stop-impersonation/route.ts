import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const cookieStore = await cookies()
  const impersonateCookie = cookieStore.get('arcon_impersonate')

  if (user && impersonateCookie?.value) {
    const adminClient = createAdminClient()
    const { data: realUser } = await adminClient
      .from('users')
      .select('id, is_admin')
      .eq('google_id', user.id)
      .single()

    if (realUser?.is_admin) {
      await logAudit({
        userId: realUser.id,
        action: 'impersonation.stop',
        status: 'success',
        details: { target_user_id: impersonateCookie.value },
      })
    }
  }

  cookieStore.delete('arcon_impersonate')

  return NextResponse.redirect(new URL('/admin/users', req.url))
}
