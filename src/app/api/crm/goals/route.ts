import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/crm/goals
// Admin: returns all goals for all users
// Non-admin: returns goals only for the logged-in user
export async function GET(_req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  let query = adminClient
    .from('crm_sales_goals')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: true })

  if (!appUser.is_admin) {
    query = query.eq('user_id', appUser.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

// POST /api/crm/goals — admin only; upsert a single goal row
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!appUser.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { user_id, year, month, goal_amount } = body

  if (!user_id || !year || !month || goal_amount == null) {
    return NextResponse.json({ error: 'user_id, year, month, goal_amount are required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Upsert on (user_id, year, month)
  const { data: existing } = await adminClient
    .from('crm_sales_goals')
    .select('id')
    .eq('user_id', user_id)
    .eq('year', year)
    .eq('month', month)
    .single()

  let result
  if (existing) {
    const { data, error } = await adminClient
      .from('crm_sales_goals')
      .update({ goal_amount, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  } else {
    const { data, error } = await adminClient
      .from('crm_sales_goals')
      .insert({ user_id, year, month, goal_amount })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  }

  return NextResponse.json(result, { status: 201 })
}
