import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

type Params = { params: Promise<{ id: string }> }

// POST /api/marketing/specs/[id]/upload-proof
// Multipart: field "file" (image or PDF) — uploads to spec-idea-images, sets proof_url.
export async function POST(req: NextRequest, { params }: Params) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 })

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Only images and PDFs allowed' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'File exceeds 20MB limit' }, { status: 400 })
  }

  const ext = file.type === 'application/pdf' ? 'pdf' : (file.type.split('/')[1]?.split(';')[0] ?? 'jpg')
  const filename = `sample-${id}-proof-${Date.now()}.${ext}`

  const adminClient = createAdminClient()

  const { error: uploadErr } = await adminClient.storage
    .from('spec-idea-images')
    .upload(filename, buffer, { contentType: file.type, upsert: false })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: { publicUrl } } = adminClient.storage.from('spec-idea-images').getPublicUrl(filename)

  const isImage = file.type !== 'application/pdf'

  const { error: updateErr } = await adminClient
    .from('spec_samples')
    .update({
      proof_url: publicUrl,
      ...(isImage ? { item_image_url: publicUrl } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ url: publicUrl }, { status: 201 })
}
