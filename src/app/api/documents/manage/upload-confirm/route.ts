import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSectionContextForFolder } from '@/lib/auth/section-manager'

// POST /api/documents/manage/upload-confirm
// Called after the client has uploaded a file directly to Supabase storage.
// Body: { folder_id, title, description?, storage_path }
export async function POST(req: NextRequest) {
  const { folder_id, title, description, storage_path } = await req.json()

  if (!folder_id) return NextResponse.json({ error: 'folder_id is required' }, { status: 400 })
  if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  if (!storage_path) return NextResponse.json({ error: 'storage_path is required' }, { status: 400 })

  const ctx = await getSectionContextForFolder(folder_id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canCreate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify the file actually exists in storage before creating the DB record
  const adminClient = createAdminClient()
  const pathParts = storage_path.split('/')
  const prefix = pathParts.slice(0, -1).join('/')
  const { data: listed } = await adminClient.storage
    .from('documents')
    .list(prefix, { search: pathParts[pathParts.length - 1] })
  if (!listed?.length) {
    return NextResponse.json({ error: 'File not found in storage — upload may have failed' }, { status: 400 })
  }

  const { data, error } = await adminClient
    .from('documents')
    .insert({
      folder_id,
      title: title.trim(),
      description: description?.trim() || null,
      storage_bucket: 'documents',
      storage_path,
      sort_order: 0,
      owner_id: ctx.user.id,
    })
    .select()
    .single()

  if (error) {
    await adminClient.storage.from('documents').remove([storage_path])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ document: data }, { status: 201 })
}
