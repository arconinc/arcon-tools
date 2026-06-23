'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function getUrlParams() {
  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return { searchParams, hashParams }
}

// Dev-only: handles the magic-link redirect from /api/dev-login.
export default function MagicCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const initialParams = getUrlParams()
    const supabase = createClient()

    async function completeMagicLogin() {
      const { searchParams, hashParams } = initialParams
      const code = searchParams.get('code')
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      } else if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return

      if (session) {
        router.replace('/dashboard')
      } else {
        router.replace('/login?error=auth_failed')
      }
    }

    completeMagicLogin().catch(() => {
      if (!cancelled) router.replace('/login?error=auth_failed')
    })

    return () => {
      cancelled = true
    }
  }, [router])

  return null
}
