import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, email, display_name, is_admin')
    .eq('google_id', user.id)
    .single()

  if (!appUser) redirect('/login')

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null

  return (
    <AppShell user={{ ...appUser, avatar_url: avatarUrl }}>
      {children}
    </AppShell>
  )
}
