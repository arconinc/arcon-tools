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
      const adminClient = createAdminClient()

      // Upsert user record on every login
      await adminClient.from('users').upsert(
        {
          google_id: user.id,
          email: user.email ?? '',
          display_name: user.user_metadata?.full_name ?? user.email ?? 'Unknown',
          last_login_at: new Date().toISOString(),
        },
        { onConflict: 'google_id' }
      )

      // Check if credentials are set up
      const { data: creds } = await adminClient
        .from('app_credentials')
        .select('id')
        .eq('user_id', (await adminClient.from('users').select('id').eq('google_id', user.id).single()).data?.id)
        .single()

      if (!creds) {
        return NextResponse.redirect(`${origin}/setup-credentials`)
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
