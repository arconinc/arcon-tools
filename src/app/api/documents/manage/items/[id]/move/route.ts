import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSectionContextForItem } from '@/lib/auth/section-manager'

// PATCH /api/documents/manage/items/[id]/move
// Moves a document to a different folder. Caller must manage the source section.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getSectionContextForItem(id)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ctx.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { folder_id } = await req.json()
  if (!folder_id) return NextResponse.json({ error: 'folder_id is required' }, { status: 400 })

  const adminClient = createAdminClient()

  // Verify destination folder exists
  const { data: destFolder } = await adminClient
    .from('doc_folders')
    .select('id')
    .eq('id', folder_id)
    .single()
  if (!destFolder) return NextResponse.json({ error: 'Destination folder not found' }, { status: 404 })

  const { error } = await adminClient
    .from('documents')
    .update({ folder_id, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
