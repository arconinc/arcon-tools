import { NextRequest } from 'next/server'
import { badRequest, ok, serverError } from '@/lib/api/respond'
import { analyzeArtwork } from '@/lib/artwork/analyze'
import { requireMockupUser } from '@/lib/hat-mockup/guard'
import { isUuid } from '@/lib/hat-mockup/request'

export const runtime = 'nodejs'
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

// POST /api/marketing/artwork/[id]/analyze  → background check + embroidery warnings for one logo
export async function POST(_req: NextRequest, { params }: Params) {
  const guard = await requireMockupUser()
  if (guard.res) return guard.res
  const { id } = await params
  if (!isUuid(id)) return badRequest('Invalid artwork id')
  const analysis = await analyzeArtwork(id)
  if (!analysis) return serverError('Could not analyze this artwork')
  return ok(analysis)
}
