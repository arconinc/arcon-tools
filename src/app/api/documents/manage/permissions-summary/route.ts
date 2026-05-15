import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSectionContext } from '@/lib/auth/section-manager'

// GET /api/documents/manage/permissions-summary?sectionId=...
// Returns lightweight permission badges for all docs in a section.
export async function GET(req: NextRequest) {
  const sectionId = req.nextUrl.searchParams.get('sectionId')
  if (!sectionId) return NextResponse.json({ error: 'sectionId is required' }, { status: 400 })

  const ctx = await getSectionContext(sectionId)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()

  // Get all doc IDs in this section
  const { data: folders } = await adminClient
    .from('doc_folders')
    .select('id')
    .eq('section_id', sectionId)

  if (!folders || folders.length === 0) return NextResponse.json({ summary: {} })

  const folderIds = folders.map(f => f.id)
  const { data: docs } = await adminClient
    .from('documents')
    .select('id, owner_id')
    .in('folder_id', folderIds)

  if (!docs || docs.length === 0) return NextResponse.json({ summary: {} })

  const docIds = docs.map(d => d.id)
  const ownerMap: Record<string, string | null> = {}
  for (const d of docs) ownerMap[d.id] = d.owner_id

  const { data: perms } = await adminClient
    .from('document_permissions')
    .select('document_id, role_id, user_id, roles(name, label)')
    .in('document_id', docIds)

  const summary: Record<string, { roles: string[]; userCount: number; ownerId: string | null }> = {}

  for (const docId of docIds) {
    summary[docId] = { roles: [], userCount: 0, ownerId: ownerMap[docId] }
  }

  for (const p of perms ?? []) {
    if (!summary[p.document_id]) continue
    if (p.role_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const label = (p as any).roles?.label ?? p.role_id
      summary[p.document_id].roles.push(label)
    }
    if (p.user_id) {
      summary[p.document_id].userCount++
    }
  }

  return NextResponse.json({ summary })
}
