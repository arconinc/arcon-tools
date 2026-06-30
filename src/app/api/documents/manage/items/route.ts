import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSectionContextForFolder } from '@/lib/auth/section-manager'

// POST /api/documents/manage/items
// Creates a document (Drive link) in the given folder. User must be a section manager.
export async function POST(request: Request) {
  const { folder_id, title, drive_url, drive_file_id, description, sort_order, required_role } = await request.json()
  if (!folder_id) return NextResponse.json({ error: 'folder_id is required' }, { status: 400 })
  if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  if (!drive_url?.trim()) return NextResponse.json({ error: 'drive_url is required' }, { status: 400 })

  const ctx = await getSectionContextForFolder(folder_id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canCreate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('documents')
    .insert({
      folder_id,
      title: title.trim(),
      drive_url: drive_url.trim(),
      drive_file_id: drive_file_id ?? null,
      description: description?.trim() ?? null,
      sort_order: sort_order ?? 0,
      required_role: required_role ?? null,
      owner_id: ctx.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ document: data }, { status: 201 })
}
