import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { fetchAndStoreOgImage } from '@/lib/specs/fetch-og-image'

type Params = { params: Promise<{ id: string }> }

// POST /api/marketing/specs/[id]/fetch-image
// Fetches og:image from vendor_link, uploads to spec-idea-images, updates item_image_url.
export async function POST(_req: NextRequest, { params }: Params) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: spec, error: specErr } = await adminClient
    .from('spec_samples')
    .select('vendor_link')
    .eq('id', id)
    .single()

  if (specErr || !spec) return NextResponse.json({ error: 'Spec not found' }, { status: 404 })
  if (!spec.vendor_link) return NextResponse.json({ error: 'No vendor_link on this spec' }, { status: 400 })

  const url = await fetchAndStoreOgImage(spec.vendor_link, id)
  if (!url) return NextResponse.json({ error: 'No og:image found or could not download' }, { status: 422 })

  return NextResponse.json({ url }, { status: 200 })
}
