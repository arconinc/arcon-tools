import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

type Params = { params: Promise<{ id: string }> }

// POST /api/marketing/spec-ideas/[id]/fetch-image
// Body: { url: string, primary?: boolean }
// Server-side fetches the image URL and saves it to Supabase Storage (avoids hotlinks/broken images).
export async function POST(req: NextRequest, { params }: Params) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!appUser.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { url, primary = true } = await req.json()

  if (!url || typeof url !== 'string') return NextResponse.json({ error: 'url is required' }, { status: 400 })

  let imageRes: Response
  try {
    imageRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch image URL' }, { status: 400 })
  }

  if (!imageRes.ok) return NextResponse.json({ error: `Remote returned ${imageRes.status}` }, { status: 400 })

  const contentType = imageRes.headers.get('content-type') ?? 'image/jpeg'
  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'URL does not point to an image' }, { status: 400 })
  }

  const buffer = Buffer.from(await imageRes.arrayBuffer())
  if (buffer.length > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image exceeds 5MB limit' }, { status: 400 })
  }

  const ext = contentType.split('/')[1]?.split(';')[0] ?? 'jpg'
  const filename = `idea-${id}-fetch-${Date.now()}.${ext}`

  const adminClient = createAdminClient()

  const { error: uploadErr } = await adminClient.storage
    .from('spec-idea-images')
    .upload(filename, buffer, { contentType, upsert: false })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: { publicUrl } } = adminClient.storage.from('spec-idea-images').getPublicUrl(filename)

  const { data: idea } = await adminClient.from('spec_ideas').select('image_url, image_urls').eq('id', id).single()
  const currentUrls: string[] = Array.isArray(idea?.image_urls) ? idea.image_urls : []

  const updatePayload: Record<string, unknown> = primary
    ? { image_url: publicUrl, updated_at: new Date().toISOString() }
    : { image_urls: [...currentUrls, publicUrl], updated_at: new Date().toISOString() }

  const { error: updateErr } = await adminClient.from('spec_ideas').update(updatePayload).eq('id', id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ url: publicUrl }, { status: 201 })
}
