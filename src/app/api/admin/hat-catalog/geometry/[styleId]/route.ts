import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { badRequest, notFound, ok, serverError } from '@/lib/api/respond'
import { requireAdmin } from '@/lib/hat-mockup/admin-guard'
import { isUuid } from '@/lib/hat-mockup/request'

type Params = { params: Promise<{ styleId: string }> }

const inRange = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

// PUT /api/admin/hat-catalog/geometry/[styleId]  { center_x, center_y, px_per_inch } → admin nudge; sync won't overwrite it
// DELETE → drop the override so the next sync re-measures
export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if (guard.res) return guard.res
  const { styleId } = await params
  if (!isUuid(styleId)) return badRequest('Invalid style')
  const b = await req.json().catch(() => ({}))
  if (!inRange(b.center_x, 0.2, 0.8) || !inRange(b.center_y, 0.1, 0.9) || !inRange(b.px_per_inch, 40, 400)) {
    return badRequest('center_x 0.2–0.8, center_y 0.1–0.9, px_per_inch 40–400')
  }
  const db = createAdminClient()
  const { data, error } = await db
    .from('hat_style_geometry')
    .update({ center_x: b.center_x, center_y: b.center_y, px_per_inch: b.px_per_inch, needs_review: false, is_override: true, confidence: 1 })
    .eq('style_id', styleId)
    .eq('view', 'fr')
    .select()
    .maybeSingle()
  if (error) return serverError(error.message)
  if (!data) return notFound('No geometry for this style yet; run a sync first')
  return ok(data)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if (guard.res) return guard.res
  const { styleId } = await params
  if (!isUuid(styleId)) return badRequest('Invalid style')
  await createAdminClient().from('hat_style_geometry').delete().eq('style_id', styleId)
  return ok({ deleted: true })
}
