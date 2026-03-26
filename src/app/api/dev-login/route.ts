import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const secret = process.env.DEV_LOGIN_SECRET
  if (secret) {
    const provided = req.nextUrl.searchParams.get('secret')
    if (provided !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const email = process.env.DEV_LOGIN_EMAIL
  if (!email) {
    return NextResponse.json({ error: 'DEV_LOGIN_EMAIL not set' }, { status: 500 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${req.nextUrl.origin}/auth/callback` },
  })

  if (error || !data.properties?.action_link) {
    return NextResponse.json({ error: error?.message ?? 'Failed to generate link' }, { status: 500 })
  }

  return NextResponse.redirect(data.properties.action_link)
}
