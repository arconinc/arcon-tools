import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import type { UploadApiResponse } from 'cloudinary'
import { createAdminClient } from '@/lib/supabase/admin'
import { cloudinary } from '@/lib/cloudinary'
import { badRequest, created, notFound, ok, serverError } from '@/lib/api/respond'
import { requireMockupUser } from '@/lib/hat-mockup/guard'
import { decodeImageDataUrl, isRenderable, isUuid, parseSelection } from '@/lib/hat-mockup/request'
import { renderMockup } from '@/lib/hat-mockup/service'

export const runtime = 'nodejs'
export const maxDuration = 60

function upload(buf: Buffer, folder: string): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ resource_type: 'image', folder }, (error, result) => (error || !result ? reject(error ?? new Error('Upload failed')) : resolve(result)))
      .end(buf)
  })
}

// GET /api/marketing/mockups?customer_id=  → saved mockups for a customer
export async function GET(req: NextRequest) {
  const guard = await requireMockupUser()
  if (guard.res) return guard.res
  const customerId = req.nextUrl.searchParams.get('customer_id')
  if (!isUuid(customerId)) return badRequest('customer_id required')
  const { data, error } = await createAdminClient()
    .from('hat_mockups')
    .select('id, title, image_url, realism_image_url, method, placement, created_at, created_by, hat_color_id, artwork_id')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) return serverError(error.message)
  return ok(data ?? [])
}

// POST /api/marketing/mockups  { session_id?, customer_id, selection, realism? { data_url, fidelity } }
export async function POST(req: NextRequest) {
  const guard = await requireMockupUser()
  if (guard.res) return guard.res
  const body = await req.json().catch(() => ({}))
  const sel = parseSelection(body.selection)
  if (!isUuid(body.customer_id)) return badRequest('Pick the customer to save this mockup to')
  if (!isRenderable(sel)) return badRequest('Nothing to save yet')

  const db = createAdminClient()
  const { data: art } = await db.from('crm_artwork').select('customer_id').eq('id', sel.artworkId).maybeSingle()
  if (!art) return notFound('Logo not found')
  if (art.customer_id !== body.customer_id) return badRequest("That logo belongs to a different customer")

  try {
    // Re-render server-side at full size; never trust a client-supplied flat image.
    const r = await renderMockup(db, sel, 1200)
    const folder = `hat-mockups/${body.customer_id}`
    const flat = await upload(r.image, folder)

    let realismUrl: string | null = null
    let fidelity: unknown = null
    const realistic = body.realism?.fidelity?.pass === true ? decodeImageDataUrl(body.realism?.data_url) : null
    if (realistic) {
      try {
        realismUrl = (await upload(realistic, folder)).secure_url
        fidelity = body.realism.fidelity
      } catch (err) {
        Sentry.captureException(err) // keep the flat mockup if the realistic upload fails
      }
    }

    const { data, error } = await db
      .from('hat_mockups')
      .insert({
        customer_id: body.customer_id,
        session_id: isUuid(body.session_id) ? body.session_id : null,
        hat_color_id: sel.colorId,
        artwork_id: sel.artworkId,
        method: sel.method,
        placement: { height_in: r.placement.heightIn, width_in: r.placement.widthIn, offset_y_in: r.placement.offsetYIn },
        image_url: flat.secure_url,
        cloudinary_public_id: flat.public_id,
        realism_image_url: realismUrl,
        fidelity,
        title: r.title,
        created_by: guard.user.id,
      })
      .select()
      .single()
    if (error) return serverError(error.message)

    if (isUuid(body.session_id)) {
      await db.from('hat_mockup_sessions').update({ saved: true }).eq('id', body.session_id).eq('user_id', guard.user.id)
    }
    return created(data)
  } catch (err) {
    Sentry.captureException(err)
    return serverError((err as Error).message || 'Could not save the mockup')
  }
}
