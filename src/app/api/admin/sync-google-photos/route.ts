import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  // Auth: must be a logged-in admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('is_admin')
    .eq('google_id', user.id)
    .single()
  if (!dbUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get session for provider_token (Google access token)
  const { data: { session } } = await supabase.auth.getSession()
  const providerToken = session?.provider_token
  if (!providerToken) {
    return NextResponse.json(
      { error: 'No Google token. Use the "Sync from Google" button to re-authenticate.' },
      { status: 400 }
    )
  }

  // Fetch all Workspace directory users using the People API (requires directory.readonly scope)
  type PersonEntry = {
    emailAddresses?: { value?: string; metadata?: { primary?: boolean } }[]
    photos?: { url?: string; metadata?: { primary?: boolean } }[]
  }

  const allPeople: PersonEntry[] = []
  let nextPageToken: string | undefined

  do {
    const url = new URL('https://people.googleapis.com/v1/people:listDirectoryPeople')
    url.searchParams.set('sources', 'DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE')
    url.searchParams.set('readMask', 'emailAddresses,photos')
    url.searchParams.set('pageSize', '1000')
    if (nextPageToken) url.searchParams.set('pageToken', nextPageToken)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${providerToken}` },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: 'Google token lacks directory scope. Use "Sync from Google" button to re-authenticate.' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: err?.error?.message ?? 'Google People API error' },
        { status: 500 }
      )
    }

    const data = await res.json()
    allPeople.push(...(data.people ?? []))
    nextPageToken = data.nextPageToken
  } while (nextPageToken)

  // Update avatar_url for each matched user
  let synced = 0
  let skipped = 0

  for (const person of allPeople) {
    const email = person.emailAddresses?.find((e) => e.metadata?.primary)?.value
      ?? person.emailAddresses?.[0]?.value
    const photoUrl = person.photos?.find((p) => p.metadata?.primary)?.url
      ?? person.photos?.[0]?.url

    if (!email || !photoUrl) { skipped++; continue }

    const { error } = await adminClient
      .from('users')
      .update({ avatar_url: photoUrl })
      .eq('email', email)

    if (!error) synced++
    else skipped++
  }

  return NextResponse.json({
    synced,
    skipped,
    total: allPeople.length,
    message: `Updated ${synced} profile photo${synced !== 1 ? 's' : ''} from Google.`,
  })
}
