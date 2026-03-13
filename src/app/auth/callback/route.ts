import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && sessionData.user) {
      const user = sessionData.user
      const email = user.email ?? ''

      if (!email.endsWith('@arconinc.com')) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=unauthorized_domain`)
      }

      const adminClient = createAdminClient()

      // Look up by email to support pre-loaded user records
      const { data: existing } = await adminClient
        .from('users')
        .select('id, google_id')
        .eq('email', email)
        .single()

      if (existing) {
        if (!existing.google_id) {
          // Pre-loaded user logging in for the first time: link their Google account.
          // Keep the admin-set display_name — do not override it.
          await adminClient
            .from('users')
            .update({ google_id: user.id, last_login_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          // Returning user: just refresh last_login_at
          await adminClient
            .from('users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', existing.id)
        }
      } else {
        // Brand new user: create a record with their Google identity
        await adminClient.from('users').insert({
          google_id: user.id,
          email,
          display_name: user.user_metadata?.full_name ?? email ?? 'Unknown',
          last_login_at: new Date().toISOString(),
        })
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
