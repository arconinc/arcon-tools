import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

export const dynamic = 'force-dynamic'

export async function GET() {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  // Closing soon: forecast_close_date within 30 days from today, status = open
  const closingSoonCutoff = new Date(now)
  closingSoonCutoff.setDate(closingSoonCutoff.getDate() + 30)
  const closingSoonStr = closingSoonCutoff.toISOString().slice(0, 10)

  // Current month range for goals
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const [
    myPipelineRes,
    closingSoonRes,
    closingSoonCountRes,
    teamOppsRes,
    myTasksRes,
    myTasksOverdueCountRes,
    allUsersRes,
    goalsRes,
  ] = await Promise.all([
    // My pipeline: open opps assigned to me
    adminClient
      .from('crm_opportunities')
      .select('id, name, customer_id, value, probability, pipeline_stage, forecast_close_date, status')
      .eq('assigned_to', appUser.id)
      .eq('status', 'open')
      .order('value', { ascending: false }),

    // Closing soon rows (capped at 20 for the list card)
    adminClient
      .from('crm_opportunities')
      .select('id, name, customer_id, assigned_to, value, pipeline_stage, forecast_close_date, status')
      .eq('status', 'open')
      .lte('forecast_close_date', closingSoonStr)
      .gte('forecast_close_date', todayStr)
      .order('forecast_close_date', { ascending: true })
      .limit(20),

    // Closing soon exact count (for stat card)
    adminClient
      .from('crm_opportunities')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')
      .lte('forecast_close_date', closingSoonStr)
      .gte('forecast_close_date', todayStr),

    // Team open opps for leaderboard (all reps)
    adminClient
      .from('crm_opportunities')
      .select('id, assigned_to, value, status')
      .eq('status', 'open')
      .not('assigned_to', 'is', null),

    // My tasks due today or overdue (capped at 10 for the list card)
    adminClient
      .from('crm_tasks')
      .select('id, title, status, priority, due_date, category, customer_id, opportunity_id')
      .eq('assigned_to', appUser.id)
      .neq('status', 'completed')
      .lte('due_date', todayStr)
      .order('due_date', { ascending: true })
      .limit(10),

    // My tasks overdue exact count (for stat card)
    adminClient
      .from('crm_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', appUser.id)
      .neq('status', 'completed')
      .lte('due_date', todayStr),

    // All users (for leaderboard + goal progress display names)
    adminClient.from('users').select('id, display_name'),

    // All goals for current year+month
    adminClient
      .from('crm_sales_goals')
      .select('user_id, goal_amount')
      .eq('year', now.getFullYear())
      .eq('month', now.getMonth() + 1),
  ])

  const closingSoonCount = closingSoonCountRes.count ?? 0
  const myTasksOverdueCount = myTasksOverdueCountRes.count ?? 0

  // Won opportunities this month (for goal progress)
  const { data: wonThisMonth } = await adminClient
    .from('crm_opportunities')
    .select('assigned_to, value')
    .eq('status', 'won')
    .not('assigned_to', 'is', null)
    .gte('closed_at', monthStart)
    .lte('closed_at', monthEnd)

  const usersMap: Record<string, string> = {}
  for (const u of allUsersRes.data ?? []) usersMap[u.id] = u.display_name

  // Enrich closing soon with customer names + user names
  const csCustIds = [...new Set((closingSoonRes.data ?? []).map((o: any) => o.customer_id).filter(Boolean))]
  const csCusts: Record<string, string> = {}
  if (csCustIds.length > 0) {
    const { data } = await adminClient.from('crm_customers').select('id, name').in('id', csCustIds)
    for (const c of data ?? []) csCusts[c.id] = c.name
  }
  const closingSoon = (closingSoonRes.data ?? []).map((o: any) => ({
    ...o,
    customer_name: csCusts[o.customer_id] ?? null,
    assigned_user_name: o.assigned_to ? (usersMap[o.assigned_to] ?? null) : null,
  }))

  // My pipeline enrichment
  const mpCustIds = [...new Set((myPipelineRes.data ?? []).map((o: any) => o.customer_id).filter(Boolean))]
  const mpCusts: Record<string, string> = {}
  if (mpCustIds.length > 0) {
    const { data } = await adminClient.from('crm_customers').select('id, name').in('id', mpCustIds)
    for (const c of data ?? []) mpCusts[c.id] = c.name
  }
  const myPipeline = (myPipelineRes.data ?? []).map((o: any) => ({
    ...o,
    customer_name: mpCusts[o.customer_id] ?? null,
  }))
  const myPipelineTotal = myPipeline.reduce((s: number, o: any) => s + (o.value ?? 0), 0)

  // Leaderboard: sum open value per user
  const leaderboardMap: Record<string, number> = {}
  for (const o of teamOppsRes.data ?? []) {
    if (!o.assigned_to) continue
    leaderboardMap[o.assigned_to] = (leaderboardMap[o.assigned_to] ?? 0) + (o.value ?? 0)
  }
  const leaderboard = Object.entries(leaderboardMap)
    .map(([userId, openValue]) => ({
      user_id: userId,
      display_name: usersMap[userId] ?? 'Unknown',
      open_value: openValue,
    }))
    .sort((a, b) => b.open_value - a.open_value)

  // Goal progress: all users who have a goal or won opps this month
  const goalsData = goalsRes.data ?? []
  const wonData = wonThisMonth ?? []

  const wonByUser: Record<string, number> = {}
  for (const o of wonData) {
    if (!o.assigned_to) continue
    wonByUser[o.assigned_to] = (wonByUser[o.assigned_to] ?? 0) + (o.value ?? 0)
  }

  const goalUserIds = [...new Set([
    ...goalsData.map((g: any) => g.user_id),
    ...Object.keys(wonByUser),
  ])]
  const goalProgress = goalUserIds.map((userId) => {
    const goalRow = goalsData.find((g: any) => g.user_id === userId)
    const goalAmount = goalRow?.goal_amount ?? 0
    const wonAmount = wonByUser[userId] ?? 0
    const pct = goalAmount > 0 ? Math.min(100, Math.round((wonAmount / goalAmount) * 100)) : 0
    return {
      user_id: userId,
      display_name: usersMap[userId] ?? 'Unknown',
      goal_amount: goalAmount,
      won_amount: wonAmount,
      pct,
    }
  }).sort((a, b) => b.pct - a.pct)

  // My tasks: enrich with linked object names
  const myTaskRows = myTasksRes.data ?? []
  const tCustIds = [...new Set(myTaskRows.map((t: any) => t.customer_id).filter(Boolean))]
  const tCusts: Record<string, string> = {}
  if (tCustIds.length > 0) {
    const { data } = await adminClient.from('crm_customers').select('id, name').in('id', tCustIds)
    for (const c of data ?? []) tCusts[c.id] = c.name
  }
  const tOppIds = [...new Set(myTaskRows.map((t: any) => t.opportunity_id).filter(Boolean))]
  const tOpps: Record<string, string> = {}
  if (tOppIds.length > 0) {
    const { data } = await adminClient.from('crm_opportunities').select('id, name').in('id', tOppIds)
    for (const o of data ?? []) tOpps[o.id] = o.name
  }
  const myTasks = myTaskRows.map((t: any) => ({
    ...t,
    linked_name: t.opportunity_id ? tOpps[t.opportunity_id] : t.customer_id ? tCusts[t.customer_id] : null,
  }))

  return NextResponse.json({
    my_pipeline: myPipeline,
    my_pipeline_total: myPipelineTotal,
    closing_soon: closingSoon,
    closing_soon_count: closingSoonCount,
    leaderboard,
    goal_progress: goalProgress,
    my_tasks: myTasks,
    my_tasks_overdue_count: myTasksOverdueCount,
    current_month: now.getMonth() + 1,
    current_year: now.getFullYear(),
  })
}
