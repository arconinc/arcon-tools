import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { hashMcpToken, parseBearerToken } from './tokens'

export interface McpUser {
  id: string
  is_admin: boolean
}

// Resolves "Authorization: Bearer arc_mcp_..." to the real user who owns the token.
// Revoked tokens and deactivated users resolve to null. Impersonation is ignored on purpose.
export async function resolveMcpUser(req: Request): Promise<McpUser | null> {
  const token = parseBearerToken(req.headers.get('authorization'))
  if (!token) return null

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('mcp_tokens')
    .select('id, users!inner(id, is_admin, deactivated_at)')
    .eq('token_hash', hashMcpToken(token))
    .is('revoked_at', null)
    .maybeSingle()

  if (!data) return null
  const user = data.users as unknown as { id: string; is_admin: boolean; deactivated_at: string | null }
  if (user.deactivated_at) return null

  try {
    await adminClient
      .from('mcp_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id)
  } catch (err) {
    Sentry.captureException(err)
  }

  return { id: user.id, is_admin: user.is_admin }
}

// Real (non-impersonated) app user for the signed-in session. Used for token management.
export async function getSessionUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await createAdminClient()
    .from('users')
    .select('id')
    .eq('google_id', user.id)
    .is('deactivated_at', null)
    .maybeSingle()

  return data?.id ?? null
}
