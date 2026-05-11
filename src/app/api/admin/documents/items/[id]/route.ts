import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  return appUser?.is_admin ? appUser : null
}

// PUT /api/admin/documents/items/[id]
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { title, drive_url, drive_file_id, description, sort_order, storage_bucket, storage_path, required_role } = await request.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const hasDriveUrl = !!drive_url?.trim()
  const hasStoragePath = !!storage_bucket?.trim() && !!storage_path?.trim()
  if (!hasDriveUrl && !hasStoragePath) {
    return NextResponse.json({ error: 'Either drive_url or storage_bucket + storage_path is required' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('documents')
    .update({
      title: title.trim(),
      drive_url: hasDriveUrl ? drive_url.trim() : null,
      drive_file_id: drive_file_id ?? null,
      description: description?.trim() ?? null,
      sort_order: sort_order ?? 0,
      storage_bucket: hasStoragePath ? storage_bucket.trim() : null,
      storage_path: hasStoragePath ? storage_path.trim() : null,
      required_role: required_role ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ document: data })
}

// DELETE /api/admin/documents/items/[id]
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const adminClient = createAdminClient()

  // Fetch first so we can clean up any stored file
  const { data: doc } = await adminClient
    .from('documents')
    .select('storage_bucket, storage_path')
    .eq('id', id)
    .single()

  const { error } = await adminClient.from('documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Best-effort: remove the file from storage (ignore errors)
  if (doc?.storage_bucket && doc?.storage_path) {
    await adminClient.storage.from(doc.storage_bucket).remove([doc.storage_path])
  }

  return NextResponse.json({ ok: true })
}
