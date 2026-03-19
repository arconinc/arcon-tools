import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// PATCH /api/crm/goals/[user_id]
// Body: { year: number, goals: { month: number, goal_amount: number }[] }
// Admin only — bulk upsert all months for a user/year in one request
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!appUser.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_id } = await params
  const body = await req.json()
  const { year, goals } = body

  if (!year || !Array.isArray(goals)) {
    return NextResponse.json({ error: 'year and goals[] array are required' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const results = []
  const now = new Date().toISOString()

  for (const entry of goals) {
    const { month, goal_amount } = entry
    if (!month || goal_amount == null) continue

    const { data: existing } = await adminClient
      .from('crm_sales_goals')
      .select('id')
      .eq('user_id', user_id)
      .eq('year', year)
      .eq('month', month)
      .single()

    if (existing) {
      const { data } = await adminClient
        .from('crm_sales_goals')
        .update({ goal_amount, updated_at: now })
        .eq('id', existing.id)
        .select()
        .single()
      if (data) results.push(data)
    } else {
      const { data } = await adminClient
        .from('crm_sales_goals')
        .insert({ user_id, year, month, goal_amount })
        .select()
        .single()
      if (data) results.push(data)
    }
  }

  return NextResponse.json(results)
}

// GET /api/crm/goals/[user_id] — admin or self
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user_id } = await params

  // Non-admins can only see their own goals
  if (!appUser.is_admin && appUser.id !== user_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_sales_goals')
    .select('*')
    .eq('user_id', user_id)
    .order('year', { ascending: false })
    .order('month', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
