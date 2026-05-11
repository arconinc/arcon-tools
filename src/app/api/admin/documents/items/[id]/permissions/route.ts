import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  return appUser?.is_admin ? appUser : null
}

// GET /api/admin/documents/items/[id]/permissions
// Returns the owner, all permission grants (with resolved user info), and whether
// the current admin is the owner (canEdit).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: docId } = await params
  const adminClient = createAdminClient()

  const [docResult, permsResult] = await Promise.all([
    adminClient
      .from('documents')
      .select('id, owner_id, users!documents_owner_id_fkey(id, display_name, email)')
      .eq('id', docId)
      .single(),
    adminClient
      .from('document_permissions')
      .select('id, document_id, department, user_id, granted_by, granted_at, users!document_permissions_user_id_fkey(id, display_name, email, avatar_url)')
      .eq('document_id', docId),
  ])

  if (!docResult.data) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const doc = docResult.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const owner = (doc as any).users ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const permissions = (permsResult.data ?? []).map((p: any) => ({
    id: p.id,
    document_id: p.document_id,
    department: p.department,
    user_id: p.user_id,
    granted_by: p.granted_by,
    granted_at: p.granted_at,
    user: p.users ?? null,
  }))

  return NextResponse.json({
    owner,
    permissions,
    canEdit: doc.owner_id === admin.id,
  })
}

// PUT /api/admin/documents/items/[id]/permissions
// Atomically replaces all permission grants for the document.
// Only the document owner may call this.
// Body: { department_grants: string[], user_grants: string[] }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: docId } = await params
  const adminClient = createAdminClient()

  // Verify ownership
  const { data: doc } = await adminClient
    .from('documents')
    .select('owner_id')
    .eq('id', docId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (doc.owner_id !== admin.id) {
    return NextResponse.json({ error: 'Only the document owner can change permissions' }, { status: 403 })
  }

  const { department_grants, user_grants } = await req.json() as {
    department_grants: string[]
    user_grants: string[]
  }

  // Atomic replace: delete all existing grants, then insert new set
  const { error: deleteError } = await adminClient
    .from('document_permissions')
    .delete()
    .eq('document_id', docId)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  const newGrants = [
    ...(department_grants ?? []).map(d => ({ document_id: docId, department: d, user_id: null, granted_by: admin.id })),
    ...(user_grants ?? []).map(u => ({ document_id: docId, department: null, user_id: u, granted_by: admin.id })),
  ]

  if (newGrants.length > 0) {
    const { error: insertError } = await adminClient
      .from('document_permissions')
      .insert(newGrants)

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
