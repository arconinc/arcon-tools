import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSectionContextForItem } from '@/lib/auth/section-manager'

// PUT /api/documents/manage/items/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getSectionContextForItem(id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, drive_url, drive_file_id, description } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('documents')
    .update({
      title: title.trim(),
      drive_url: drive_url?.trim() ?? null,
      drive_file_id: drive_file_id ?? null,
      description: description?.trim() ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ document: data })
}

// DELETE /api/documents/manage/items/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getSectionContextForItem(id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()

  // Fetch doc to clean up storage
  const { data: doc } = await adminClient
    .from('documents')
    .select('storage_bucket, storage_path')
    .eq('id', id)
    .single()

  if (doc?.storage_bucket && doc?.storage_path) {
    await adminClient.storage.from(doc.storage_bucket).remove([doc.storage_path])
  }

  const { error } = await adminClient.from('documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
