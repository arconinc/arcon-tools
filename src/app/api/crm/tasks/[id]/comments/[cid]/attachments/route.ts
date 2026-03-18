import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// POST /api/crm/tasks/[id]/comments/[cid]/attachments
// Body: { url, label, file_name?, file_size?, mime_type?, is_drive_link? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cid } = await params
  const body = await req.json()
  const { url, label, file_name, file_size, mime_type, is_drive_link = false } = body

  if (!url?.trim()) return NextResponse.json({ error: 'url is required' }, { status: 400 })
  if (!label?.trim()) return NextResponse.json({ error: 'label is required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_comment_attachments')
    .insert({
      comment_id: cid,
      url: url.trim(),
      label: label.trim(),
      file_name: file_name ?? null,
      file_size: file_size ?? null,
      mime_type: mime_type ?? null,
      is_drive_link,
      uploaded_by: appUser.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/crm/tasks/[id]/comments/[cid]/attachments/[aid] — handled in sub-route
