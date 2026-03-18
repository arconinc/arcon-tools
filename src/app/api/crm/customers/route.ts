import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/crm/customers?search=&status=&assigned_to=
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim()
  const status = searchParams.get('status')
  const assignedTo = searchParams.get('assigned_to')

  const adminClient = createAdminClient()
  let query = adminClient
    .from('crm_customers')
    .select('id, name, client_status, phone, website, tags, assigned_to, created_at, updated_at')
    .order('name')

  if (search) query = query.ilike('name', `%${search}%`)
  if (status) query = query.eq('client_status', status)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve assigned_to display names
  const userIds = [...new Set((data ?? []).map((c: any) => c.assigned_to).filter(Boolean))]
  let usersMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: users } = await adminClient
      .from('users')
      .select('id, display_name')
      .in('id', userIds)
    for (const u of users ?? []) usersMap[u.id] = u.display_name
  }

  const enriched = (data ?? []).map((c: any) => ({
    ...c,
    assigned_user_name: c.assigned_to ? (usersMap[c.assigned_to] ?? null) : null,
  }))

  return NextResponse.json(enriched)
}

// POST /api/crm/customers
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, ...rest } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  // Strip any fields that shouldn't be set on create
  const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb, ...safeRest } = rest

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_customers')
    .insert({ name: name.trim(), ...safeRest, created_by: appUser.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
