import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/marketing/specs/stats
// Returns dashboard stat counts: sent this month, pending follow-ups, in_production, no_response
export async function GET() {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = now.toISOString().slice(0, 10)

  const [sentThisMonth, pendingFollowUps, inProduction, awaitingResponse] = await Promise.all([
    adminClient
      .from('spec_samples')
      .select('*', { count: 'exact', head: true })
      .gte('date_sent', monthStart),
    adminClient
      .from('spec_samples')
      .select('*', { count: 'exact', head: true })
      .lte('follow_up_date', today)
      .not('follow_up_date', 'is', null)
      .not('status', 'in', '(approved,declined)'),
    adminClient
      .from('spec_samples')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_production'),
    adminClient
      .from('spec_samples')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'no_response'),
  ])

  return NextResponse.json({
    sent_this_month: sentThisMonth.count ?? 0,
    pending_follow_ups: pendingFollowUps.count ?? 0,
    in_production: inProduction.count ?? 0,
    awaiting_response: awaitingResponse.count ?? 0,
  })
}
