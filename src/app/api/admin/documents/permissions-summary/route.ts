import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/documents/permissions-summary
// Returns a lightweight summary of permissions for all documents.
// Used by the admin document tree to render inline permission badges without
// opening each document's full permission modal.
// Shape: { [docId]: { depts: string[], userCount: number, ownerId: string | null } }
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  if (!appUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [docsResult, permsResult] = await Promise.all([
    adminClient.from('documents').select('id, owner_id'),
    adminClient.from('document_permissions').select('document_id, department, user_id'),
  ])

  const docs = docsResult.data ?? []
  const perms = permsResult.data ?? []

  const summary: Record<string, { depts: string[]; userCount: number; ownerId: string | null }> = {}

  for (const doc of docs) {
    summary[doc.id] = { depts: [], userCount: 0, ownerId: doc.owner_id }
  }

  for (const p of perms) {
    if (!summary[p.document_id]) continue
    if (p.department) summary[p.document_id].depts.push(p.department)
    if (p.user_id) summary[p.document_id].userCount++
  }

  return NextResponse.json(summary)
}
