import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSectionContextForItem } from '@/lib/auth/section-manager'

// GET /api/documents/manage/items/[id]/permissions
// Returns owner, all grants, and canEdit flag.
// Section managers can always edit permissions (not restricted to owner).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: docId } = await params
  const ctx = await getSectionContextForItem(docId)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  const [docResult, permsResult] = await Promise.all([
    adminClient
      .from('documents')
      .select('id, owner_id, users!documents_owner_id_fkey(id, display_name, email)')
      .eq('id', docId)
      .single(),
    adminClient
      .from('document_permissions')
      .select('id, document_id, role_id, user_id, granted_by, granted_at, roles(id, name, label, color), users!document_permissions_user_id_fkey(id, display_name, email, avatar_url)')
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
    role_id: p.role_id,
    role: p.roles ?? null,
    user_id: p.user_id,
    granted_by: p.granted_by,
    granted_at: p.granted_at,
    user: p.users ?? null,
  }))

  // Section managers can always edit — not restricted to document owner
  return NextResponse.json({ owner, permissions, canEdit: true })
}

// PUT /api/documents/manage/items/[id]/permissions
// Atomically replaces all grants. Any section manager can do this.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: docId } = await params
  const ctx = await getSectionContextForItem(docId)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { role_grants, user_grants } = await req.json() as {
    role_grants: string[]
    user_grants: string[]
  }

  const adminClient = createAdminClient()

  const { data: doc } = await adminClient
    .from('documents')
    .select('id')
    .eq('id', docId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const { error: deleteError } = await adminClient
    .from('document_permissions')
    .delete()
    .eq('document_id', docId)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  const newGrants = [
    ...(role_grants ?? []).map(r => ({ document_id: docId, role_id: r, user_id: null, granted_by: ctx.user.id })),
    ...(user_grants ?? []).map(u => ({ document_id: docId, role_id: null, user_id: u, granted_by: ctx.user.id })),
  ]

  if (newGrants.length > 0) {
    const { error: insertError } = await adminClient.from('document_permissions').insert(newGrants)
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
