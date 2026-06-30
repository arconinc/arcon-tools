import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { userHasAccessGroup } from '@/lib/auth/group-access'

export default async function HrTasksLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()

  if (!dbUser) redirect('/login')

  if (!dbUser.is_admin) {
    const isHr = await userHasAccessGroup(adminClient, dbUser.id, ['access:hr_access'])
    if (!isHr) redirect('/dashboard')
  }

  return <>{children}</>
}
