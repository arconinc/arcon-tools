import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'
import { badRequest, fail, ok } from '@/lib/api/respond'
import { loadLogoPng } from '@/lib/artwork/logo'
import { requireMockupUser } from '@/lib/hat-mockup/guard'
import { checkFidelity, generateRealistic, isRealismConfigured } from '@/lib/hat-mockup/realism'
import { isRenderable, parseSelection } from '@/lib/hat-mockup/request'
import { loadArtwork, renderMockup, toDataUrl } from '@/lib/hat-mockup/service'

export const runtime = 'nodejs'
export const maxDuration = 120

const DAILY_CAP = 40
const usage = new Map<string, { day: string; count: number }>()

// ponytail: per-instance in-memory cap; move to a DB counter if renders get expensive or abused.
function underCap(userId: string): boolean {
  const day = new Date().toISOString().slice(0, 10)
  const u = usage.get(userId)
  if (!u || u.day !== day) {
    usage.set(userId, { day, count: 1 })
    return true
  }
  if (u.count >= DAILY_CAP) return false
  u.count++
  return true
}

// POST /api/marketing/mockups/realism  { selection } → realistic render that passed the logo check, or the reason it didn't
export async function POST(req: NextRequest) {
  const guard = await requireMockupUser()
  if (guard.res) return guard.res
  if (!isRealismConfigured()) return fail(503, 'Realistic renders are not configured (GEMINI_API_KEY)')

  const body = await req.json().catch(() => ({}))
  const sel = parseSelection(body.selection)
  if (!isRenderable(sel)) return badRequest('Render a mockup first')
  if (!underCap(guard.user.id)) return fail(429, `Daily limit of ${DAILY_CAP} realistic renders reached`)

  const db = createAdminClient()
  try {
    const flat = await renderMockup(db, sel)
    const logo = await loadLogoPng(await loadArtwork(db, sel.artworkId))
    const realistic = await sharp(await generateRealistic(flat.image, sel.method)).jpeg({ quality: 88 }).toBuffer()
    const fidelity = await checkFidelity({ flat: flat.image, realistic, placement: flat.placement, logo })
    return ok({ fidelity, dataUrl: fidelity.pass ? toDataUrl(realistic) : null })
  } catch (err) {
    Sentry.captureException(err)
    return ok({ fidelity: null, dataUrl: null, error: 'Realistic render failed; the flat mockup is still good to use.' })
  }
}
