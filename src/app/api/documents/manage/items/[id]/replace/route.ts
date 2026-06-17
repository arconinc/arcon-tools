import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSectionContextForItem } from '@/lib/auth/section-manager'

const MAX_SIZE = 50 * 1024 * 1024

// POST /api/documents/manage/items/[id]/replace
// Replaces the file or drive URL for a document and increments its version.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getSectionContextForItem(id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  const { data: existing } = await adminClient
    .from('documents')
    .select('storage_bucket, storage_path, version')
    .eq('id', id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File exceeds 50 MB limit' }, { status: 400 })

    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const bucket = 'documents'
    const storagePath = `${existing.storage_path?.split('/')[0] ?? id}/${crypto.randomUUID()}-${sanitized}`

    const bytes = await file.arrayBuffer()
    const { error: uploadError } = await adminClient.storage
      .from(bucket)
      .upload(storagePath, bytes, { contentType: file.type, upsert: false })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    // Delete old file if it was a stored upload
    if (existing.storage_bucket && existing.storage_path) {
      await adminClient.storage.from(existing.storage_bucket).remove([existing.storage_path])
    }

    const { data, error } = await adminClient
      .from('documents')
      .update({
        storage_bucket: bucket,
        storage_path: storagePath,
        drive_url: null,
        drive_file_id: null,
        version: (existing.version ?? 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ document: data })
  } else if (contentType.includes('application/json')) {
    const body = await req.json()

    // Pre-uploaded file path (client uploaded directly to Supabase storage)
    if (body.storage_path) {
      if (existing.storage_bucket && existing.storage_path) {
        await adminClient.storage.from(existing.storage_bucket).remove([existing.storage_path])
      }

      const { data, error } = await adminClient
        .from('documents')
        .update({
          storage_bucket: 'documents',
          storage_path: body.storage_path,
          drive_url: null,
          drive_file_id: null,
          version: (existing.version ?? 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ document: data })
    }

    // Drive URL replacement
    const { drive_url } = body
    if (!drive_url?.trim()) return NextResponse.json({ error: 'drive_url is required' }, { status: 400 })

    if (existing.storage_bucket && existing.storage_path) {
      await adminClient.storage.from(existing.storage_bucket).remove([existing.storage_path])
    }

    const { data, error } = await adminClient
      .from('documents')
      .update({
        drive_url: drive_url.trim(),
        drive_file_id: null,
        storage_bucket: null,
        storage_path: null,
        version: (existing.version ?? 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ document: data })
  } else {
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
  }
}
