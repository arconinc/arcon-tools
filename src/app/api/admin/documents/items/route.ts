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

// GET /api/admin/documents/items
export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('documents')
    .select('*')
    .order('sort_order')
    .order('title')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ documents: data })
}

// POST /api/admin/documents/items
export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, drive_url, drive_file_id, description, folder_id, sort_order, storage_bucket, storage_path, required_role } = await request.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (!folder_id) return NextResponse.json({ error: 'folder_id is required' }, { status: 400 })

  const hasDriveUrl = !!drive_url?.trim()
  const hasStoragePath = !!storage_bucket?.trim() && !!storage_path?.trim()
  if (!hasDriveUrl && !hasStoragePath) {
    return NextResponse.json({ error: 'Either drive_url or storage_bucket + storage_path is required' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('documents')
    .insert({
      title: title.trim(),
      drive_url: hasDriveUrl ? drive_url.trim() : null,
      drive_file_id: drive_file_id ?? null,
      description: description?.trim() ?? null,
      folder_id,
      sort_order: sort_order ?? 0,
      storage_bucket: hasStoragePath ? storage_bucket.trim() : null,
      storage_path: hasStoragePath ? storage_path.trim() : null,
      required_role: required_role ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ document: data }, { status: 201 })
}
