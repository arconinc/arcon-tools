import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { badRequest, created, ok, serverError } from '@/lib/api/respond'
import { requireAdmin } from '@/lib/hat-mockup/admin-guard'
import { isUuid } from '@/lib/hat-mockup/request'

const cleanTemplate = (v: unknown) => (typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 140 ? v.trim() : null)

// POST /api/admin/hat-catalog/starters  { template }  → new curated starter (use {customer} for the customer name)
export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard.res) return guard.res
  const b = await req.json().catch(() => ({}))
  const template = cleanTemplate(b.template)
  if (!template) return badRequest('Starter text must be 1–140 characters')
  const { data, error } = await createAdminClient().from('hat_mockup_starters').insert({ template, source: 'curated' }).select().single()
  if (error) return serverError(error.message)
  return created(data)
}

// PUT /api/admin/hat-catalog/starters  { id, template?, is_pinned?, is_hidden? }
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard.res) return guard.res
  const b = await req.json().catch(() => ({}))
  if (!isUuid(b.id)) return badRequest('Invalid starter')
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.template !== undefined) {
    const t = cleanTemplate(b.template)
    if (!t) return badRequest('Starter text must be 1–140 characters')
    patch.template = t
    patch.is_pinned = true // an edited learned starter must survive the nightly refresh
  }
  if (typeof b.is_pinned === 'boolean') patch.is_pinned = b.is_pinned
  if (typeof b.is_hidden === 'boolean') patch.is_hidden = b.is_hidden
  const { data, error } = await createAdminClient().from('hat_mockup_starters').update(patch).eq('id', b.id).select().single()
  if (error) return serverError(error.message)
  return ok(data)
}
