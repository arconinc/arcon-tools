import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSectionContext } from '@/lib/auth/section-manager'

// POST /api/documents/manage/folders
// Creates a folder in the given section. User must be a section manager.
export async function POST(request: Request) {
  const { section_id, name, sort_order, required_role, parent_folder_id } = await request.json()
  if (!section_id) return NextResponse.json({ error: 'section_id is required' }, { status: 400 })
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const ctx = await getSectionContext(section_id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('doc_folders')
    .insert({ section_id, name: name.trim(), sort_order: sort_order ?? 0, required_role: required_role ?? null, parent_folder_id: parent_folder_id ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ folder: data }, { status: 201 })
}
