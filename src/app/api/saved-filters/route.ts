import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, badRequest, serverError, created, ok } from '@/lib/api/respond'

// GET /api/saved-filters?page_key=my-tasks
// Returns own filters + shared filters from all users, for the given page_key
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { searchParams } = new URL(req.url)
  const pageKey = searchParams.get('page_key')
  if (!pageKey) return badRequest('page_key required')

  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('saved_filters')
    .select('id, user_id, page_key, name, filter_config, is_shared, created_at, updated_at, users(display_name, avatar_url)')
    .eq('page_key', pageKey)
    .or(`user_id.eq.${appUser.id},is_shared.eq.true`)
    .order('name', { ascending: true })

  if (error) return serverError(error.message)

  return ok(data)
}

// POST /api/saved-filters
// Body: { page_key, name, filter_config, is_shared }
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  let body: { page_key?: string; name?: string; filter_config?: Record<string, unknown>; is_shared?: boolean }
  try {
    body = await req.json()
  } catch {
    return badRequest('Invalid JSON')
  }

  const { page_key, name, filter_config, is_shared } = body
  if (!page_key || typeof page_key !== 'string') return badRequest('page_key required')
  if (!name || typeof name !== 'string' || !name.trim()) return badRequest('name required')
  if (!filter_config || typeof filter_config !== 'object') return badRequest('filter_config required')

  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('saved_filters')
    .insert({
      user_id: appUser.id,
      page_key: page_key.trim(),
      name: name.trim(),
      filter_config,
      is_shared: is_shared === true,
    })
    .select('id, user_id, page_key, name, filter_config, is_shared, created_at, updated_at, users(display_name, avatar_url)')
    .single()

  if (error) return serverError(error.message)

  return created(data)
}
