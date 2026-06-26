import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, notFound, badRequest, serverError, ok } from '@/lib/api/respond'

// PUT /api/saved-filters/[id]
// Body: { name?, filter_config?, is_shared? }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { id } = await params

  let body: { name?: string; filter_config?: Record<string, unknown>; is_shared?: boolean }
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON')
  }

  const adminClient = createAdminClient()

  // Verify ownership
  const { data: existing } = await adminClient
    .from('saved_filters')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (!existing) return notFound()
  if (existing.user_id !== appUser.id) return unauthorized()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) return badRequest('name must be non-empty string')
    updates.name = body.name.trim()
  }
  if (body.filter_config !== undefined) {
    if (typeof body.filter_config !== 'object') return badRequest('filter_config must be object')
    updates.filter_config = body.filter_config
  }
  if (body.is_shared !== undefined) {
    updates.is_shared = body.is_shared === true
  }

  const { data, error } = await adminClient
    .from('saved_filters')
    .update(updates)
    .eq('id', id)
    .select('id, user_id, page_key, name, filter_config, is_shared, created_at, updated_at, users(display_name, avatar_url)')
    .single()

  if (error) return serverError(error.message)

  return ok(data)
}

// DELETE /api/saved-filters/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { id } = await params
  const adminClient = createAdminClient()

  // Verify ownership
  const { data: existing } = await adminClient
    .from('saved_filters')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (!existing) return notFound()
  if (existing.user_id !== appUser.id) return unauthorized()

  const { error } = await adminClient.from('saved_filters').delete().eq('id', id)
  if (error) return serverError(error.message)

  return ok({ deleted: true })
}
