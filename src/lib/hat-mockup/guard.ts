import { NextResponse } from 'next/server'
import { requireUser, type CrmUser } from '@/lib/crm/require-user'
import { unauthorized } from '@/lib/api/respond'

/** Auth for every hat mockup route. */
export async function requireMockupUser(): Promise<{ user: CrmUser; res?: never } | { user?: never; res: NextResponse }> {
  const user = await requireUser()
  if (!user) return { res: unauthorized() }
  return { user }
}

export function cronAuthorized(request: Request): boolean {
  // Bearer token only. Do not trust x-vercel-cron: any caller can send that header.
  const secret = process.env.CRON_SECRET
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`
}
