import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDocAccessContext, filterAccessibleDocuments } from '@/lib/documents/access'

// GET /api/documents — returns section > folder > document tree filtered by user's access.
// Section/folder access is still gated by required_role (existing behavior).
// Document access uses the new fine-grained permission model (owner + dept + individual).
// drive_url is omitted from the response — clients must call /api/documents/open to get it.
export async function GET() {
  const adminClient = createAdminClient()

  // Resolve effective user (impersonation aware) + roles
  const ctx = await getDocAccessContext(adminClient)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { isAdmin, roles } = ctx

  // Section/folder required_role gating (unchanged from previous behavior)
  function canAccessSection(required_role: string | null): boolean {
    if (isAdmin) return true
    if (!required_role) return true
    return roles.includes(required_role)
  }

  const [{ data: sections }, { data: folders }, { data: docs }] = await Promise.all([
    adminClient.from('doc_sections').select('*').order('sort_order').order('name'),
    adminClient.from('doc_folders').select('*').order('sort_order').order('name'),
    adminClient.from('documents').select('*').order('sort_order').order('title'),
  ])

  // Document-level access filtering (owner + role + individual grants); admins bypass
  const visibleDocs = await filterAccessibleDocuments(adminClient, docs ?? [], ctx)
  const visibleDocIds = new Set(visibleDocs.map(d => d.id))
  function canSeeDoc(doc: { id: string }): boolean {
    return visibleDocIds.has(doc.id)
  }

  // Build a nested folder tree for each section
  function buildFolderTree(
    sectionId: string,
    parentId: string | null,
    allFolders: typeof folders,
    allDocs: typeof docs,
  ): object[] {
    return (allFolders ?? [])
      .filter(f =>
        f.section_id === sectionId &&
        (f.parent_folder_id ?? null) === parentId &&
        canAccessSection(f.required_role),
      )
      .map(f => ({
        ...f,
        documents: (allDocs ?? [])
          .filter(d => d.folder_id === f.id && canSeeDoc(d))
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .map(({ drive_url: _omit, ...rest }) => rest),
        children: buildFolderTree(sectionId, f.id, allFolders, allDocs),
      }))
  }

  const tree = (sections ?? [])
    .filter(s => canAccessSection(s.required_role))
    .map(s => ({
      ...s,
      folders: buildFolderTree(s.id, null, folders, docs),
    }))

  return NextResponse.json({ sections: tree })
}
