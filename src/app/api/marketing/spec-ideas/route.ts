import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/marketing/spec-ideas?q=&vendor=&category=&tags=tag1,tag2&active_only=true
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const vendor = searchParams.get('vendor')?.trim()
  const category = searchParams.get('category')?.trim()
  const tagsParam = searchParams.get('tags')
  const activeOnly = searchParams.get('active_only') !== 'false'
  const limit = Math.min(1000, parseInt(searchParams.get('limit') ?? '200', 10))

  const adminClient = createAdminClient()
  let query = adminClient.from('spec_ideas').select('*').order('vendor').order('item_name')

  if (activeOnly) query = query.eq('is_active', true)
  if (vendor) query = query.ilike('vendor', `%${vendor}%`)
  if (category) query = query.eq('category', category)
  if (q) query = query.or(`item_name.ilike.%${q}%,vendor.ilike.%${q}%,notes.ilike.%${q}%,item_number.ilike.%${q}%`)
  if (tagsParam) {
    const tags = tagsParam.split(',').map(t => t.trim()).filter(Boolean)
    if (tags.length > 0) query = query.overlaps('tags', tags)
  }

  query = query.limit(limit)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

// POST /api/marketing/spec-ideas  (admin only)
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!appUser.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { item_name, vendor } = body
  if (!item_name?.trim()) return NextResponse.json({ error: 'item_name is required' }, { status: 400 })
  if (!vendor?.trim()) return NextResponse.json({ error: 'vendor is required' }, { status: 400 })

  const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb, ...rest } = body

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('spec_ideas')
    .insert({ ...rest, item_name: item_name.trim(), vendor: vendor.trim(), created_by: appUser.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
