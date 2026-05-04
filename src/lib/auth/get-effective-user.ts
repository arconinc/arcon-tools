import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface EffectiveUser {
  id: string
  email: string
  display_name: string
  is_admin: boolean
  avatar_url: string | null
}

export interface EffectiveUserResult {
  effectiveUser: EffectiveUser
  isImpersonating: boolean
  realUserIsAdmin: boolean
}

export async function getEffectiveUser(): Promise<EffectiveUserResult | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const adminClient = createAdminClient()
  const { data: realUser } = await adminClient
    .from('users')
    .select('id, email, display_name, is_admin')
    .eq('google_id', user.id)
    .single()
  if (!realUser) return null

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null

  if (realUser.is_admin) {
    const cookieStore = await cookies()
    const impersonateCookie = cookieStore.get('arcon_impersonate')
    if (impersonateCookie?.value) {
      const { data: target } = await adminClient
        .from('users')
        .select('id, email, display_name, is_admin, avatar_url')
        .eq('id', impersonateCookie.value)
        .is('deactivated_at', null)
        .single()
      if (target && !target.is_admin) {
        return {
          effectiveUser: {
            id: target.id,
            email: target.email,
            display_name: target.display_name,
            is_admin: false,
            avatar_url: target.avatar_url,
          },
          isImpersonating: true,
          realUserIsAdmin: true,
        }
      }
    }
  }

  return {
    effectiveUser: { ...realUser, avatar_url: avatarUrl },
    isImpersonating: false,
    realUserIsAdmin: realUser.is_admin,
  }
}
