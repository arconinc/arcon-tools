import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSectionContextForFolder } from '@/lib/auth/section-manager'

// POST /api/documents/manage/folders/reorder
// Body: { updates: Array<{ id: string; sort_order: number }> }
// All folders must belong to the same section; user must be a manager of that section.
export async function POST(request: Request) {
  const { updates } = await request.json() as { updates: Array<{ id: string; sort_order: number }> }
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates is required' }, { status: 400 })
  }

  // Verify permission using the first folder's section
  const ctx = await getSectionContextForFolder(updates[0].id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()

  // Verify all folders belong to the same section
  const { data: folders } = await adminClient
    .from('doc_folders')
    .select('id, section_id')
    .in('id', updates.map(u => u.id))

  if (!folders || folders.length !== updates.length) {
    return NextResponse.json({ error: 'Some folders not found' }, { status: 404 })
  }
  const allSameSection = folders.every(f => f.section_id === ctx.section.id)
  if (!allSameSection) {
    return NextResponse.json({ error: 'Folders must all be in the same section' }, { status: 400 })
  }

  // Update sort_orders
  await Promise.all(
    updates.map(({ id, sort_order }) =>
      adminClient.from('doc_folders').update({ sort_order }).eq('id', id)
    )
  )

  return NextResponse.json({ ok: true })
}
