import { getEffectiveUser } from '@/lib/auth/get-effective-user'
import { redirect } from 'next/navigation'
import { getEvaluatedFlags } from '@/lib/flags'
import AppShell from '@/components/layout/AppShell'

export default async function EmployeesLayout({ children }: { children: React.ReactNode }) {
  const result = await getEffectiveUser()
  if (!result) redirect('/login')
  const flags = await getEvaluatedFlags()
  return (
    <AppShell user={result.effectiveUser} isImpersonating={result.isImpersonating} impersonatedUserName={result.isImpersonating ? result.effectiveUser.display_name : undefined} evaluatedFlags={flags}>
      {children}
    </AppShell>
  )
}
