import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

type Params = { params: Promise<{ id: string }> }

// POST /api/marketing/spec-ideas/[id]/upload
// Accepts multipart/form-data with `file` field.
// Uploads to spec-idea-images bucket, updates spec_ideas row.
export async function POST(req: NextRequest, { params }: Params) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!appUser.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const isPrimary = formData.get('primary') === 'true'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File must be 5MB or smaller' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `idea-${id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const adminClient = createAdminClient()

  const { error: uploadErr } = await adminClient.storage
    .from('spec-idea-images')
    .upload(filename, buffer, { contentType: file.type, upsert: false })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: { publicUrl } } = adminClient.storage.from('spec-idea-images').getPublicUrl(filename)

  // Fetch current idea to update image_urls array
  const { data: idea } = await adminClient.from('spec_ideas').select('image_url, image_urls').eq('id', id).single()

  const currentUrls: string[] = Array.isArray(idea?.image_urls) ? idea.image_urls : []

  let updatePayload: Record<string, unknown>
  if (isPrimary) {
    updatePayload = {
      image_url: publicUrl,
      updated_at: new Date().toISOString(),
    }
  } else {
    updatePayload = {
      image_urls: [...currentUrls, publicUrl],
      updated_at: new Date().toISOString(),
    }
  }

  const { error: updateErr } = await adminClient.from('spec_ideas').update(updatePayload).eq('id', id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ url: publicUrl }, { status: 201 })
}
