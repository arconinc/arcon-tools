import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/marketing/tasks/[id]/attachments
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_task_attachments')
    .select('*')
    .eq('task_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/marketing/tasks/[id]/attachments
// Body: multipart/form-data with 'file' field, or JSON { url, label, file_name, file_size, mime_type }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()

  // Verify task exists
  const { data: task, error: taskErr } = await adminClient
    .from('crm_tasks')
    .select('id')
    .eq('id', id)
    .single()
  if (taskErr || !task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${appUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitized}`

    const { error: uploadErr } = await adminClient.storage
      .from('crm-attachments')
      .upload(path, buffer, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

    const { data: { publicUrl } } = adminClient.storage.from('crm-attachments').getPublicUrl(path)

    const { data, error } = await adminClient
      .from('crm_task_attachments')
      .insert({
        task_id: id,
        url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: appUser.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }

  // JSON body: pre-uploaded file URL
  const body = await req.json()
  const { url, label, file_name, file_size, mime_type } = body
  if (!url || !file_name) return NextResponse.json({ error: 'url and file_name are required' }, { status: 400 })

  const { data, error } = await adminClient
    .from('crm_task_attachments')
    .insert({ task_id: id, url, label: label ?? null, file_name, file_size: file_size ?? null, mime_type: mime_type ?? null, uploaded_by: appUser.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/marketing/tasks/[id]/attachments?attachment_id=<uuid>
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const attachmentId = new URL(req.url).searchParams.get('attachment_id')
  if (!attachmentId) return NextResponse.json({ error: 'attachment_id required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data: att } = await adminClient
    .from('crm_task_attachments')
    .select('uploaded_by')
    .eq('id', attachmentId)
    .eq('task_id', id)
    .single()

  if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!appUser.is_admin && att.uploaded_by !== appUser.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await adminClient.from('crm_task_attachments').delete().eq('id', attachmentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
