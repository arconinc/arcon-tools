import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET() {
  const adminClient = createAdminClient()

  const { data: tag } = await adminClient
    .from('crm_tags')
    .select('id')
    .eq('name', 'AttendedProductShowcase2026')
    .maybeSingle()

  if (!tag?.id) return NextResponse.json({ count: 0 })

  const { count, error } = await adminClient
    .from('crm_entity_tags')
    .select('*', { count: 'exact', head: true })
    .eq('tag_id', tag.id)
    .eq('entity_type', 'contact')

  if (error) return NextResponse.json({ count: 0 })

  return NextResponse.json({ count: count ?? 0 })
}
