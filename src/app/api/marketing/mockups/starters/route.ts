import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ok } from '@/lib/api/respond'
import { requireMockupUser } from '@/lib/hat-mockup/guard'
import { isUuid } from '@/lib/hat-mockup/request'
import { getStarters } from '@/lib/hat-mockup/starters'

// GET /api/marketing/mockups/starters?customer_id=  → { recent, team } starter prompts
export async function GET(req: NextRequest) {
  const guard = await requireMockupUser()
  if (guard.res) return guard.res
  const db = createAdminClient()
  const customerId = req.nextUrl.searchParams.get('customer_id')
  let customerName: string | null = null
  if (isUuid(customerId)) {
    const { data } = await db.from('crm_customers').select('name').eq('id', customerId).maybeSingle()
    customerName = data?.name ?? null
  }
  return ok(await getStarters(db, guard.user.id, customerName))
}
