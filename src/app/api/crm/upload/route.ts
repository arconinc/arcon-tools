import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const BUCKET = 'crm-attachments'

export async function POST(request: Request) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File must be 10MB or smaller' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${appUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const adminClient = createAdminClient()

  // Ensure bucket exists
  const { data: buckets } = await adminClient.storage.listBuckets()
  if (!buckets?.find((b) => b.name === BUCKET)) {
    const { error: bucketErr } = await adminClient.storage.createBucket(BUCKET, { public: true })
    if (bucketErr) {
      return NextResponse.json({ error: `Could not create storage bucket: ${bucketErr.message}` }, { status: 500 })
    }
  }

  const { error: uploadErr } = await adminClient.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: { publicUrl } } = adminClient.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json(
    {
      url: publicUrl,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
    },
    { status: 201 }
  )
}
