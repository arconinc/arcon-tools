import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSectionContextForFolder } from '@/lib/auth/section-manager'

// PUT /api/documents/manage/folders/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getSectionContextForFolder(id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, sort_order, required_role } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('doc_folders')
    .update({ name: name.trim(), sort_order: sort_order ?? 0, required_role: required_role ?? null })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ folder: data })
}

// DELETE /api/documents/manage/folders/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getSectionContextForFolder(id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()

  // Get all documents in the folder to clean up storage files
  const { data: docs } = await adminClient
    .from('documents')
    .select('id, storage_bucket, storage_path')
    .eq('folder_id', id)

  // Remove storage files
  for (const doc of docs ?? []) {
    if (doc.storage_bucket && doc.storage_path) {
      await adminClient.storage.from(doc.storage_bucket).remove([doc.storage_path])
    }
  }

  const { error } = await adminClient.from('doc_folders').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
