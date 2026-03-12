import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const BUCKET = 'banner-images'

export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('is_admin')
    .eq('google_id', user.id)
    .single()
  if (!appUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Parse multipart form
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File must be 5MB or smaller' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `slide-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Ensure bucket exists (creates it on first use)
  const { data: buckets } = await adminClient.storage.listBuckets()
  if (!buckets?.find((b) => b.name === BUCKET)) {
    const { error: bucketErr } = await adminClient.storage.createBucket(BUCKET, { public: true })
    if (bucketErr) return NextResponse.json({ error: `Could not create storage bucket: ${bucketErr.message}` }, { status: 500 })
  }

  const { error: uploadErr } = await adminClient.storage
    .from(BUCKET)
    .upload(filename, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: { publicUrl } } = adminClient.storage.from(BUCKET).getPublicUrl(filename)

  return NextResponse.json({ url: publicUrl }, { status: 201 })
}
