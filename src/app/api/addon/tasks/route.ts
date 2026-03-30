import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAddonUser } from '../auth'

// POST /api/addon/tasks
// Creates a CRM task on behalf of the authenticated Gmail Add-On user.
export async function POST(req: NextRequest) {
  const addonUser = await requireAddonUser(req)
  if (!addonUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, assigned_to, category, priority, due_date } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_tasks')
    .insert({
      title: title.trim(),
      description: description ?? null,
      assigned_to: assigned_to ?? addonUser.id,
      task_owner: addonUser.id,
      category: category ?? 'To Do General',
      priority: priority ?? 'medium',
      due_date: due_date ?? null,
      status: 'not_started',
      progress: 0,
      created_by: addonUser.id,
    })
    .select('id, title')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ task: data }, { status: 201 })
}
