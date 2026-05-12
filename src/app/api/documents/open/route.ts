import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { canAccessDocument } from '@/lib/access'

// GET /api/documents/open?docId=<id>
// Unified gated entry point for opening any document — both uploaded files and Drive links.
// Returns { type: 'signed', url } for uploaded files or { type: 'drive', url } for Drive links.
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

  // Fetch document + permissions + user roles in parallel
  const [docResult, permsResult, directRolesResult, deptRolesResult] = await Promise.all([
    adminClient
      .from('documents')
      .select('id, drive_url, storage_bucket, storage_path, required_role, owner_id')
      .eq('id', docId)
      .single(),
    adminClient
      .from('document_permissions')
      .select('role_id, user_id, roles(name)')
      .eq('document_id', docId),
    adminClient.from('user_roles').select('roles(name)').eq('user_id', effectiveUserId),
    adminClient.from('user_departments').select('department_roles(roles(name))').eq('user_id', effectiveUserId),
  ])

  const doc = docResult.data
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const userRoleNames = new Set<string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (directRolesResult.data ?? []) as any[]) if (r.roles?.name) userRoleNames.add(r.roles.name)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const ud of (deptRolesResult.data ?? []) as any[]) for (const dr of ud.department_roles ?? []) if (dr.roles?.name) userRoleNames.add(dr.roles.name)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleGrants = (permsResult.data ?? []).map((p: any) => p.roles?.name).filter((n: unknown): n is string => !!n)
  if (doc.required_role) roleGrants.push(doc.required_role)
  const userGrants = (permsResult.data ?? []).map(p => p.user_id).filter((u): u is string => !!u)

  const allowed = canAccessDocument(
    { ownerId: doc.owner_id, roleGrants, userGrants },
    { id: effectiveUserId, roles: [...userRoleNames] }
  )
  if (!allowed) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  // Drive link
  if (doc.drive_url) {
    return NextResponse.json({ type: 'drive', url: doc.drive_url })
  }

  // Uploaded file — generate a 1-hour signed URL
  if (doc.storage_bucket && doc.storage_path) {
    const { data, error } = await adminClient.storage
      .from(doc.storage_bucket)
      .createSignedUrl(doc.storage_path, 3600)

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Could not generate signed URL' }, { status: 500 })
    }
    return NextResponse.json({ type: 'signed', url: data.signedUrl })
  }

  return NextResponse.json({ error: 'Document has no associated file' }, { status: 400 })
}
