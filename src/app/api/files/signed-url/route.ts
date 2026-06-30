import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasFileAccess, requiredRoleFor } from '@/lib/access'
import { PRIVATE_BUCKETS } from '@/lib/permissions'
import { getUserAccessGroupKeys } from '@/lib/auth/group-access'

// GET /api/files/signed-url?bucket=financial-reports&path=2026-04.pdf
// Issues a 1-hour signed URL for files in private Supabase Storage buckets.
// Access is verified against the user's roles before the URL is issued.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const bucket = searchParams.get('bucket')
  const path = searchParams.get('path')

  if (!bucket || !path) {
    return NextResponse.json({ error: 'bucket and path are required' }, { status: 400 })
  }

  if (!PRIVATE_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: 'Not a private bucket' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Resolve effective user (impersonation aware)
  const { data: realUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  if (!realUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let effectiveUserId = realUser.id
  let isAdmin = realUser.is_admin

  if (isAdmin) {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const impersonateCookie = cookieStore.get('arcon_impersonate')
    if (impersonateCookie?.value) {
      const { data: target } = await adminClient
        .from('users')
        .select('id, is_admin')
        .eq('id', impersonateCookie.value)
        .is('deactivated_at', null)
        .single()
      if (target && !target.is_admin) {
        effectiveUserId = target.id
        isAdmin = false
      }
    }
  }

  // Check access-group-based access
  let accessGroups: string[] = []
  if (!isAdmin) {
    accessGroups = await getUserAccessGroupKeys(adminClient, effectiveUserId)

    // Also check individual file_permissions grants
    const { data: filePerm } = await adminClient
      .from('file_permissions')
      .select('can_read')
      .eq('bucket', bucket)
      .eq('user_id', effectiveUserId)
      .maybeSingle()

    const hasIndividualGrant = filePerm?.can_read === true

    if (!hasIndividualGrant && !hasFileAccess(accessGroups, false, bucket)) {
      const role = requiredRoleFor(`file:bucket:${bucket}`)
      const requestUrl = `/access-requests/new?resource=file%3Abucket%3A${bucket}&role=${role ?? ''}`
      return NextResponse.json(
        { error: 'Access denied', requestAccessUrl: requestUrl },
        { status: 403 }
      )
    }
  }

  // Issue signed URL (1 hour)
  const { data, error } = await adminClient.storage
    .from(bucket)
    .createSignedUrl(path, 3600)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate signed URL' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: data.signedUrl })
}
