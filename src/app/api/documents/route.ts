import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/documents — returns full section > folder > document tree (auth required)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  const [{ data: sections }, { data: folders }, { data: docs }] = await Promise.all([
    adminClient.from('doc_sections').select('*').order('sort_order').order('name'),
    adminClient.from('doc_folders').select('*').order('sort_order').order('name'),
    adminClient.from('documents').select('*').order('sort_order').order('title'),
  ])

  const tree = (sections ?? []).map(s => ({
    ...s,
    folders: (folders ?? [])
      .filter(f => f.section_id === s.id)
      .map(f => ({
        ...f,
        documents: (docs ?? []).filter(d => d.folder_id === f.id),
      })),
  }))

  return NextResponse.json({ sections: tree })
}
