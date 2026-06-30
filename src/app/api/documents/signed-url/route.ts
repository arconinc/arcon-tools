import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { canAccessDocument } from '@/lib/access'
import { getUserAccessGroupKeys, normalizeAccessGroupKey } from '@/lib/auth/group-access'

// GET /api/documents/signed-url?docId=<id>
// Issues a 1-hour signed URL for an uploaded document file.
// Admins are NOT exempt — all users go through canAccessDocument.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const docId = req.nextUrl.searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'docId is required' }, { status: 400 })

  const adminClient = createAdminClient()

  // Resolve effective user (impersonation aware)
  const { data: realUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  if (!realUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let effectiveUserId = realUser.id

  if (realUser.is_admin) {
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
      }
    }
  }

  // Fetch document + permissions + user access groups in parallel
  const [docResult, permsResult, userAccessGroups] = await Promise.all([
    adminClient
      .from('documents')
      .select('id, storage_bucket, storage_path, required_role, owner_id')
      .eq('id', docId)
      .single(),
    adminClient
      .from('document_permissions')
      .select('group_id, user_id, groups!document_permissions_group_id_fkey(key)')
      .eq('document_id', docId),
    getUserAccessGroupKeys(adminClient, effectiveUserId),
  ])

  const doc = docResult.data
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (!doc.storage_bucket || !doc.storage_path) {
    return NextResponse.json({ error: 'Document has no stored file' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleGrants = (permsResult.data ?? []).map((p: any) => p.groups?.key).filter((n: unknown): n is string => !!n)
  const requiredGroup = normalizeAccessGroupKey(doc.required_role)
  if (requiredGroup) roleGrants.push(requiredGroup)
  const userGrants = (permsResult.data ?? []).map(p => p.user_id).filter((u): u is string => !!u)

  const allowed = canAccessDocument(
    { ownerId: doc.owner_id, roleGrants, userGrants },
    { id: effectiveUserId, roles: userAccessGroups }
  )
  if (!allowed) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const { data, error } = await adminClient.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, 3600)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate signed URL' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: data.signedUrl })
}
