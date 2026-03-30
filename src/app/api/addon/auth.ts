import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface AddonUser {
  id: string
  email: string
  display_name: string
}

/**
 * Authenticates requests from the Gmail Add-On.
 *
 * Expects:
 *   Authorization: Bearer <ADDON_API_KEY>
 *   X-User-Email: <gmail user email>
 *
 * Returns the matching Arc user, or null if auth fails.
 */
export async function requireAddonUser(req: NextRequest): Promise<AddonUser | null> {
  const authHeader = req.headers.get('authorization')
  const userEmail = req.headers.get('x-user-email')

  if (!authHeader || !userEmail) return null

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const apiKey = process.env.ADDON_API_KEY
  if (!apiKey || token !== apiKey) return null

  const adminClient = createAdminClient()
  const { data: user } = await adminClient
    .from('users')
    .select('id, email, display_name')
    .eq('email', userEmail.toLowerCase().trim())
    .single()

  if (!user) return null
  return user as AddonUser
}
