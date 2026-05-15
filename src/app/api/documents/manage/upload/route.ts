import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSectionContextForFolder } from '@/lib/auth/section-manager'

const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

// POST /api/documents/manage/upload
// Multipart upload. Fields: file, title, folder_id, description (optional)
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const title = (formData.get('title') as string | null)?.trim()
  const folder_id = formData.get('folder_id') as string | null
  const description = (formData.get('description') as string | null)?.trim() || null

  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  if (!folder_id) return NextResponse.json({ error: 'folder_id is required' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File exceeds 50 MB limit' }, { status: 400 })

  const ctx = await getSectionContextForFolder(folder_id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${folder_id}/${crypto.randomUUID()}-${sanitized}`
  const bucket = 'documents'

  const adminClient = createAdminClient()
  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await adminClient.storage
    .from(bucket)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data, error: dbError } = await adminClient
    .from('documents')
    .insert({
      folder_id,
      title,
      description,
      storage_bucket: bucket,
      storage_path: storagePath,
      sort_order: 0,
      owner_id: ctx.user.id,
    })
    .select()
    .single()

  if (dbError) {
    await adminClient.storage.from(bucket).remove([storagePath])
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ document: data }, { status: 201 })
}
