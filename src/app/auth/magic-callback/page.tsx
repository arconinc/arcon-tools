'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Dev-only: handles the magic-link hash redirect from /api/dev-login.
// createBrowserClient automatically detects #access_token=... in the hash,
// exchanges it for a session, and stores it in cookies for SSR compatibility.
export default function MagicCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Wait for SIGNED_IN — the browser client processes #access_token from the hash
    // asynchronously, so INITIAL_SESSION may fire before the session is ready.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.replace('/dashboard')
      }
    })

    // Fallback: if no session within 10s, redirect to login with error
    const timeout = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) router.replace('/login?error=auth_failed')
      })
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router])

  return null
}
