import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { badRequest, ok, serverError } from '@/lib/api/respond'
import { requireAdmin } from '@/lib/hat-mockup/admin-guard'
import { METHODS } from '@/lib/hat-mockup/request'

const inches = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 8

// PUT /api/admin/hat-catalog/rules  { method, max_width_in, max_height_in, default_height_in, notes? }
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard.res) return guard.res
  const b = await req.json().catch(() => ({}))
  if (!(METHODS as readonly string[]).includes(b.method)) return badRequest('Unknown decoration method')
  if (!inches(b.max_width_in) || !inches(b.max_height_in) || !inches(b.default_height_in)) return badRequest('Sizes must be inches between 0 and 8')
  if (b.default_height_in > b.max_height_in) return badRequest('Default height cannot exceed max height')
  const { data, error } = await createAdminClient()
    .from('hat_placement_rules')
    .upsert(
      {
        method: b.method,
        location: 'front',
        max_width_in: b.max_width_in,
        max_height_in: b.max_height_in,
        default_height_in: b.default_height_in,
        notes: typeof b.notes === 'string' ? b.notes.slice(0, 500) : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'method,location' },
    )
    .select()
    .single()
  if (error) return serverError(error.message)
  return ok(data)
}
