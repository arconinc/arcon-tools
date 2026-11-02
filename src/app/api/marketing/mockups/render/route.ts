import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { badRequest, ok, serverError } from '@/lib/api/respond'
import { requireMockupUser } from '@/lib/hat-mockup/guard'
import { isRenderable, parseSelection } from '@/lib/hat-mockup/request'
import { renderMockup, toDataUrl } from '@/lib/hat-mockup/service'

export const runtime = 'nodejs'
export const maxDuration = 30

// POST /api/marketing/mockups/render  { selection }  — re-render without the model (pickers + adjust buttons)
export async function POST(req: NextRequest) {
  const guard = await requireMockupUser()
  if (guard.res) return guard.res

  const body = await req.json().catch(() => ({}))
  const sel = parseSelection(body.selection)
  if (!isRenderable(sel)) return badRequest('Pick a hat color, a logo and a decoration method first')

  try {
    const r = await renderMockup(createAdminClient(), sel)
    return ok({
      dataUrl: toDataUrl(r.image),
      title: r.title,
      heightIn: r.placement.heightIn,
      widthIn: r.placement.widthIn,
      offsetYIn: r.placement.offsetYIn,
      clamped: r.placement.clamped,
      styleId: r.style.id,
    })
  } catch (err) {
    Sentry.captureException(err)
    return serverError((err as Error).message || 'Could not render the mockup')
  }
}
