import { getEffectiveUser } from '@/lib/auth/get-effective-user'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const result = await getEffectiveUser()
  if (!result) redirect('/login')
  if (!result.realUserIsAdmin) redirect('/dashboard')

  return <>{children}</>
}
