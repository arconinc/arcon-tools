import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

export const dynamic = 'force-dynamic'

const BUCKET_LABELS = ['This Month', 'Next Month', '+2 Months', '90+ Days'] as const

function getBucketIndex(closeDateStr: string, now: Date): number {
  const close = new Date(closeDateStr + 'T00:00:00')
  const y = now.getFullYear()
  const m = now.getMonth() // 0-indexed

  // End of each month boundary
  const endThisMonth = new Date(y, m + 1, 0)
  const endNextMonth = new Date(y, m + 2, 0)
  const endTwoMonths = new Date(y, m + 3, 0)

  if (close <= endThisMonth) return 0
  if (close <= endNextMonth) return 1
  if (close <= endTwoMonths) return 2
  return 3
}

export async function GET() {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const now = new Date()

  const [oppsRes, usersRes] = await Promise.all([
    adminClient
      .from('crm_opportunities')
      .select('value, forecast_close_date, assigned_to')
      .eq('status', 'open')
      .not('forecast_close_date', 'is', null)
      .not('assigned_to', 'is', null),
    adminClient.from('users').select('id, display_name'),
  ])

  const usersMap: Record<string, string> = {}
  for (const u of usersRes.data ?? []) usersMap[u.id] = u.display_name

  // buckets[bucketIndex][salesPersonName] = total value
  const buckets: Record<string, number>[] = [
    {}, {}, {}, {},
  ]
  const salespeopleSet = new Set<string>()

  for (const opp of oppsRes.data ?? []) {
    const name = usersMap[opp.assigned_to] ?? 'Unknown'
    const idx = getBucketIndex(opp.forecast_close_date, now)
    buckets[idx][name] = (buckets[idx][name] ?? 0) + (opp.value ?? 0)
    salespeopleSet.add(name)
  }

  const salespeople = [...salespeopleSet].sort()

  const result = BUCKET_LABELS.map((label, i) => ({
    label,
    ...buckets[i],
  }))

  return NextResponse.json({ buckets: result, salespeople })
}
