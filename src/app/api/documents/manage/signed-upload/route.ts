import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSectionContextForFolder, getSectionContextForItem } from '@/lib/auth/section-manager'

// POST /api/documents/manage/signed-upload
// Returns a signed URL for direct browser-to-Supabase upload.
// Body: { folder_id, filename, content_type } for new docs
//       { item_id, filename, content_type } for replacements
export async function POST(req: NextRequest) {
  const { folder_id, item_id, filename, content_type } = await req.json()

  if (!filename || !content_type) {
    return NextResponse.json({ error: 'filename and content_type are required' }, { status: 400 })
  }

  let folderId: string

  if (item_id) {
    const ctx = await getSectionContextForItem(item_id)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!ctx.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    // derive folder from the item
    const adminClient = createAdminClient()
    const { data: doc } = await adminClient.from('documents').select('folder_id').eq('id', item_id).single()
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    folderId = doc.folder_id
  } else if (folder_id) {
    const ctx = await getSectionContextForFolder(folder_id)
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!ctx.canCreate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    folderId = folder_id
  } else {
    return NextResponse.json({ error: 'folder_id or item_id is required' }, { status: 400 })
  }

  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${folderId}/${crypto.randomUUID()}-${sanitized}`

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.storage
    .from('documents')
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create upload URL' }, { status: 500 })
  }

  return NextResponse.json({ uploadUrl: data.signedUrl, storagePath, token: data.token })
}
