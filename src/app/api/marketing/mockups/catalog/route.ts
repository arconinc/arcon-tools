import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ok } from '@/lib/api/respond'
import { requireMockupUser } from '@/lib/hat-mockup/guard'
import { isUuid } from '@/lib/hat-mockup/request'

// GET /api/marketing/mockups/catalog            → active hat styles for the pickers
// GET /api/marketing/mockups/catalog?style_id=  → that style's colors
export async function GET(req: NextRequest) {
  const guard = await requireMockupUser()
  if (guard.res) return guard.res
  const db = createAdminClient()
  const styleId = req.nextUrl.searchParams.get('style_id')

  if (isUuid(styleId)) {
    const { data } = await db
      .from('hat_colors')
      .select('id, name, hex, hex_secondary')
      .eq('style_id', styleId)
      .eq('is_active', true)
      .order('name')
    return ok({ colors: data ?? [] })
  }

  const [{ data: styles }, { data: lastSync }] = await Promise.all([
    db
      .from('hat_styles')
      .select('id, brand, style_number, name, silhouette, profile, hat_decoration_methods(method, minimum_quantity)')
      .eq('is_active', true)
      .order('brand')
      .order('style_number'),
    db.from('hat_catalog_syncs').select('finished_at').eq('status', 'ok').order('finished_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  return ok({ styles: styles ?? [], syncedAt: lastSync?.finished_at ?? null })
}
