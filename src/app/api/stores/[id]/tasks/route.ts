import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_tasks')
    .select('*, assigned_user:users!crm_tasks_assigned_to_fkey(id, display_name, avatar_url)')
    .eq('store_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id')
    .eq('google_id', user.id)
    .single()
  if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await request.json()
  const { title, priority = 'medium', category, due_date, description, assigned_to } = body
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const { data, error } = await adminClient
    .from('crm_tasks')
    .insert({
      title,
      priority,
      category: category ?? null,
      due_date: due_date ?? null,
      description: description ?? null,
      assigned_to: assigned_to ?? null,
      store_id: id,
      status: 'open',
      progress: 0,
      created_by: appUser.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
