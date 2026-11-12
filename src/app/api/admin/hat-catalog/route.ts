import { createAdminClient } from '@/lib/supabase/admin'
import { ok } from '@/lib/api/respond'
import { requireAdmin } from '@/lib/hat-mockup/admin-guard'
import { publicBlankUrl } from '@/lib/hat-mockup/service'

// GET /api/admin/hat-catalog → sync log, styles with geometry, placement rules, starters
export async function GET() {
  const guard = await requireAdmin()
  if (guard.res) return guard.res
  const db = createAdminClient()

  const [syncs, styles, rules, starters] = await Promise.all([
    db
      .from('hat_catalog_syncs')
      .select('id, started_at, finished_at, trigger, status, styles_seen, colors_seen, requests_made, next_delay_ms, errors')
      .order('started_at', { ascending: false })
      .limit(10),
    db
      .from('hat_styles')
      .select('id, brand, style_number, name, profile, silhouette, is_active, last_checked_at, hat_colors(count), hat_style_geometry(*)')
      .order('brand')
      .order('style_number'),
    db.from('hat_placement_rules').select('*').order('method'),
    db.from('hat_mockup_starters').select('*').order('is_pinned', { ascending: false }).order('uses', { ascending: false }),
  ])

  // Blank image to draw the geometry box on, for styles that need review.
  const review = (styles.data ?? []).filter((s) => {
    const g = (s.hat_style_geometry as { needs_review: boolean }[] | null)?.[0]
    return g?.needs_review
  })
  const reviewImages: Record<string, string | null> = {}
  await Promise.all(
    review.map(async (s) => {
      const g = (s.hat_style_geometry as { source_color_code: string }[])[0]
      const { data } = await db
        .from('hat_colors')
        .select('front_image_path')
        .eq('style_id', s.id)
        .eq('color_code', g.source_color_code)
        .maybeSingle()
      reviewImages[s.id] = data?.front_image_path ? publicBlankUrl(db, data.front_image_path) : null
    }),
  )

  return ok({ syncs: syncs.data ?? [], styles: styles.data ?? [], rules: rules.data ?? [], starters: starters.data ?? [], reviewImages })
}
