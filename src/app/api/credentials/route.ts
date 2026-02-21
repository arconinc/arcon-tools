import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { saveCredentials, getCredentialUpdatedAt } from '@/lib/credentials'
import { buildAuthHeader } from '@/lib/encryption'
import { validateCredentials } from '@/lib/promobuillit/api'

async function getAppUser(googleId: string) {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('users')
    .select('id')
    .eq('google_id', googleId)
    .single()
  return data
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { username, password } = await request.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
  }

  // Validate credentials against PromoBullit API before saving
  const authHeader = buildAuthHeader(username, password)
  const valid = await validateCredentials(authHeader)

  if (!valid) {
    return NextResponse.json(
      { error: 'Invalid PromoBullit credentials. Please check your username and password.' },
      { status: 400 }
    )
  }

  const appUser = await getAppUser(user.id)
  if (!appUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await saveCredentials(appUser.id, username, password)

  return NextResponse.json({ success: true })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appUser = await getAppUser(user.id)
  if (!appUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const updatedAt = await getCredentialUpdatedAt(appUser.id)
  return NextResponse.json({ updatedAt })
}
