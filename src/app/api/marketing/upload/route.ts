import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

const MAX_SIZE_BYTES = 50 * 1024 * 1024 // 50MB
const BUCKET = 'crm-attachments'

export async function POST(request: Request) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Support old clients that still send multipart/form-data
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ error: 'File must be 50MB or smaller' }, { status: 400 })
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${appUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const adminClient = createAdminClient()
    const { data: buckets } = await adminClient.storage.listBuckets()
    if (!buckets?.find((b) => b.name === BUCKET)) {
      const { error: bucketErr } = await adminClient.storage.createBucket(BUCKET, { public: true })
      if (bucketErr) return NextResponse.json({ error: `Could not create storage bucket: ${bucketErr.message}` }, { status: 500 })
    }
    const { error: uploadErr } = await adminClient.storage.from(BUCKET).upload(path, buffer, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })
    const { data: { publicUrl } } = adminClient.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: publicUrl, file_name: file.name, file_size: file.size, mime_type: file.type || null }, { status: 201 })
  }

  const body = await request.json()
  const { fileName, fileSize, mimeType } = body as { fileName: string; fileSize: number; mimeType: string }

  if (!fileName || typeof fileSize !== 'number') {
    return NextResponse.json({ error: 'fileName and fileSize required' }, { status: 400 })
  }
  if (fileSize > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File must be 50MB or smaller' }, { status: 400 })
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${appUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`

  const adminClient = createAdminClient()

  // Ensure bucket exists
  const { data: buckets } = await adminClient.storage.listBuckets()
  if (!buckets?.find((b) => b.name === BUCKET)) {
    const { error: bucketErr } = await adminClient.storage.createBucket(BUCKET, { public: true })
    if (bucketErr) {
      return NextResponse.json({ error: `Could not create storage bucket: ${bucketErr.message}` }, { status: 500 })
    }
  }

  const { data: signedData, error: signedErr } = await adminClient.storage
    .from(BUCKET)
    .createSignedUploadUrl(path)

  if (signedErr || !signedData) {
    return NextResponse.json({ error: signedErr?.message ?? 'Failed to create upload URL' }, { status: 500 })
  }

  const { data: { publicUrl } } = adminClient.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json(
    {
      signedUrl: signedData.signedUrl,
      path,
      url: publicUrl,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType || null,
    },
    { status: 200 }
  )
}
