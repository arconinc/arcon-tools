import { getEffectiveUser } from '@/lib/auth/get-effective-user'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'

export default async function AdminExpenseReportsLayout({ children }: { children: React.ReactNode }) {
  const result = await getEffectiveUser()
  if (!result) redirect('/login')
  if (!result.realUserIsAdmin) redirect('/dashboard')
  return (
    <AppShell user={result.effectiveUser} isImpersonating={result.isImpersonating} impersonatedUserName={result.isImpersonating ? result.effectiveUser.display_name : undefined}>
      {children}
    </AppShell>
  )
}
