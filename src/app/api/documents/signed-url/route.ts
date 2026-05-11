import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// GET /api/documents/signed-url?docId=<id>
// Issues a 1-hour signed URL for an uploaded document file.
// The user must have the required role at the document, folder, and section levels.
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
  let isAdmin = realUser.is_admin

  if (isAdmin) {
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

  // Fetch document + folder + section in one query
  const { data: doc } = await adminClient
    .from('documents')
    .select(`
      id, storage_bucket, storage_path, required_role,
      doc_folders(required_role, doc_sections(required_role))
    `)
    .eq('id', docId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (!doc.storage_bucket || !doc.storage_path) {
    return NextResponse.json({ error: 'Document has no stored file' }, { status: 400 })
  }

  if (!isAdmin) {
    const { data: userRoles } = await adminClient
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', effectiveUserId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roleNames: string[] = (userRoles ?? []).map((r: any) => r.roles?.name).filter(Boolean)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const folder = Array.isArray(doc.doc_folders) ? doc.doc_folders[0] : (doc.doc_folders as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const section = folder ? (Array.isArray(folder.doc_sections) ? folder.doc_sections[0] : (folder.doc_sections as any)) : null

    const requiredRoles: string[] = [
      doc.required_role,
      folder?.required_role ?? null,
      section?.required_role ?? null,
    ].filter((r): r is string => !!r)

    const missing = requiredRoles.find(r => !roleNames.includes(r))
    if (missing) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
  }

  const { data, error } = await adminClient.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, 3600)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate signed URL' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: data.signedUrl })
}
