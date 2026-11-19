import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUserId } from '@/lib/mcp/auth'
import { generateMcpToken, hashMcpToken } from '@/lib/mcp/tokens'
import { unauthorized, ok, created, badRequest, serverError } from '@/lib/api/respond'

const TOKEN_FIELDS = 'id, name, created_at, last_used_at, revoked_at'

// GET /api/mcp/tokens — the signed-in user's tokens. Never returns the token or its hash.
export async function GET() {
  const userId = await getSessionUserId()
  if (!userId) return unauthorized()

  const { data, error } = await createAdminClient()
    .from('mcp_tokens')
    .select(TOKEN_FIELDS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return serverError('Could not load tokens.')
  return ok({ tokens: data ?? [] })
}

// POST /api/mcp/tokens — body { name }. The plaintext token is returned once and never stored.
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId()
  if (!userId) return unauthorized()

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 60) return badRequest('Name is required (60 characters max).')

  const token = generateMcpToken()
  const { data, error } = await createAdminClient()
    .from('mcp_tokens')
    .insert({ user_id: userId, name, token_hash: hashMcpToken(token) })
    .select(TOKEN_FIELDS)
    .single()

  if (error || !data) return serverError('Could not create token.')
  return created({ token, ...data })
}
