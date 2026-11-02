import { NextResponse } from 'next/server'
import { requireUser, type CrmUser } from '@/lib/crm/require-user'
import { forbidden, unauthorized } from '@/lib/api/respond'

/** Admin-only hat catalog routes. requireUser() returns non-admin while impersonating, so admin actions are blocked then. */
export async function requireAdmin(): Promise<{ user: CrmUser; res?: never } | { user?: never; res: NextResponse }> {
  const user = await requireUser()
  if (!user) return { res: unauthorized() }
  if (!user.is_admin) return { res: forbidden() }
  return { user }
}
