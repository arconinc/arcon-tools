import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUserId } from '@/lib/mcp/auth'
import { unauthorized, ok, badRequest, notFound, serverError } from '@/lib/api/respond'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// DELETE /api/mcp/tokens/[id] — revokes one of the signed-in user's tokens. Soft: sets revoked_at.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId()
  if (!userId) return unauthorized()

  const { id } = await params
  if (!UUID_RE.test(id)) return badRequest('Invalid token id.')

  const { data, error } = await createAdminClient()
    .from('mcp_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .is('revoked_at', null)
    .select('id')

  if (error) return serverError('Could not revoke token.')
  if (!data || data.length === 0) return notFound('Token not found.')
  return ok({ success: true })
}
