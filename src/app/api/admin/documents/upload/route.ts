import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'documents'
const MAX_BYTES = 50 * 1024 * 1024 // 50 MB

// POST /api/admin/documents/upload
// Accepts multipart/form-data: file, title, folder_id, description (optional)
// Uploads to the private "documents" bucket and creates the DB record.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  if (!appUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  const folderId = form.get('folder_id') as string | null
  const title = (form.get('title') as string | null)?.trim() || null
  const description = (form.get('description') as string | null)?.trim() || null
  const requiredRole = (form.get('required_role') as string | null)?.trim() || null

  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
  if (!folderId) return NextResponse.json({ error: 'folder_id is required' }, { status: 400 })
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 50 MB limit' }, { status: 413 })
  }

  // Path: <folderId>/<uuid>-<sanitized-filename>
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const uuid = crypto.randomUUID()
  const storagePath = `${folderId}/${uuid}-${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await adminClient.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Count existing docs in folder for sort_order
  const { count } = await adminClient
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('folder_id', folderId)

  const { data: doc, error: dbError } = await adminClient
    .from('documents')
    .insert({
      title,
      description,
      folder_id: folderId,
      drive_url: null,
      drive_file_id: null,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      required_role: requiredRole,
      sort_order: count ?? 0,
    })
    .select()
    .single()

  if (dbError) {
    // Roll back the uploaded file
    await adminClient.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ document: doc }, { status: 201 })
}
