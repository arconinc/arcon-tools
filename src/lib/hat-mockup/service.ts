import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { BLANKS_BUCKET, blankImagePath, blankImageUrl } from '@/lib/hat-catalog/config'
import { createPoliteFetcher, type PoliteFetcher } from '@/lib/hat-catalog/fetcher'
import { analyzeArtwork } from '@/lib/artwork/analyze'
import { loadLogoPng, type LogoArtwork } from '@/lib/artwork/logo'
import { composeMockup, type PlacementRule } from './compose'
import { computeGeometry, contrastRatio, isPlausible, luminance, mergeGeometry, type Geometry, type Profile } from './geometry'

type Db = ReturnType<typeof createAdminClient>

export type HatStyleRow = {
  id: string
  brand: string
  style_number: string
  name: string
  url: string
  categories: string[]
  silhouette: string | null
  profile: Profile | null
  details: string[]
  sizes: string | null
  price_breaks: { quantity: number; price_cents: number }[] | null
  default_color_code: string | null
  is_active: boolean
}

export type HatColorRow = {
  id: string
  style_id: string
  color_code: string
  name: string
  hex: string | null
  hex_secondary: string | null
  front_image_path: string | null
}

export type MockupSelection = {
  customerId?: string | null
  customerName?: string | null
  artworkId?: string | null
  styleId?: string | null
  colorId?: string | null
  method?: string | null
  heightIn?: number | null
  offsetYIn?: number | null
}

export const METHOD_LABELS: Record<string, string> = {
  embroidery: 'Embroidery',
  printing: 'Printing',
  leather_patch: 'Leather patch',
  printed_patch: 'Printed patch',
}

export function publicBlankUrl(db: Db, path: string): string {
  return db.storage.from(BLANKS_BUCKET).getPublicUrl(path).data.publicUrl
}

export function priceAt(breaks: HatStyleRow['price_breaks'], quantity: number): number | null {
  if (!breaks?.length) return null
  let price: number | null = null
  for (const b of [...breaks].sort((a, b) => a.quantity - b.quantity)) if (quantity >= b.quantity) price = b.price_cents
  return price ?? breaks[0].price_cents
}

/**
 * Lightness of a color for geometry: the lighter of crown and mesh. Light
 * parts blend into the white background, so measure the darkest colors.
 */
export function geometryLightness(c: Pick<HatColorRow, 'hex' | 'hex_secondary'>): number {
  return Math.max(luminance(c.hex ?? '#808080'), c.hex_secondary ? luminance(c.hex_secondary) : 0)
}

export async function getRule(db: Db, method: string): Promise<PlacementRule> {
  const { data } = await db
    .from('hat_placement_rules')
    .select('method, max_width_in, max_height_in, default_height_in')
    .eq('method', method)
    .eq('location', 'front')
    .maybeSingle()
  if (data) return { ...data, max_width_in: +data.max_width_in, max_height_in: +data.max_height_in, default_height_in: +data.default_height_in }
  return { method, max_width_in: 4.5, max_height_in: 2.25, default_height_in: 2 }
}

/**
 * The blank front image for one color, fetching it from the vendor the first
 * time it's needed (one request through the polite fetcher) and caching it.
 */
export async function ensureBlankImage(
  db: Db,
  style: Pick<HatStyleRow, 'style_number'>,
  color: HatColorRow,
  fetcher: PoliteFetcher = createPoliteFetcher({ budget: 1 }),
): Promise<Buffer> {
  if (color.front_image_path) {
    const { data } = await db.storage.from(BLANKS_BUCKET).download(color.front_image_path)
    if (data) return Buffer.from(await data.arrayBuffer())
  }
  const res = await fetcher.get(blankImageUrl(style.style_number, color.color_code))
  if (res.status !== 200) throw new Error(`Blank image not available for ${style.style_number} ${color.name} (HTTP ${res.status})`)
  const buf = await res.buffer()
  const path = blankImagePath(style.style_number, color.color_code)
  const { error } = await db.storage.from(BLANKS_BUCKET).upload(path, buf, { contentType: 'image/jpeg', upsert: true })
  if (error) Sentry.captureException(error)
  else await db.from('hat_colors').update({ front_image_path: path }).eq('id', color.id)
  return buf
}

export async function getGeometry(db: Db, style: HatStyleRow, color: HatColorRow, blank: Buffer): Promise<Geometry> {
  const { data } = await db.from('hat_style_geometry').select('*').eq('style_id', style.id).eq('view', 'fr').maybeSingle()
  if (data) {
    const stored: Geometry = {
      crown_top_y: +data.crown_top_y,
      bill_seam_y: +data.bill_seam_y,
      crown_left_x: +data.crown_left_x,
      crown_right_x: +data.crown_right_x,
      center_x: +data.center_x,
      center_y: +data.center_y,
      px_per_inch: +data.px_per_inch,
      confidence: +data.confidence,
    }
    // Admin overrides are trusted; anything else that's implausible gets re-measured.
    if (data.is_override || isPlausible(stored)) return stored
  }
  // Not measured yet (or measured badly): measure from this color and keep it.
  const g = mergeGeometry(await computeGeometry(blank, style.profile), null)
  const { needs_review, ...geometry } = g
  await db.from('hat_style_geometry').upsert({
    style_id: style.id,
    view: 'fr',
    source_color_code: color.color_code,
    ...geometry,
    needs_review: needs_review || geometryLightness(color) > 0.5,
    computed_at: new Date().toISOString(),
  })
  return geometry
}

export async function loadArtwork(db: Db, artworkId: string): Promise<LogoArtwork & { customer_id: string; name: string }> {
  const { data } = await db
    .from('crm_artwork')
    .select('id, customer_id, name, url, cloudinary_public_id, cloudinary_resource_type, is_drive_link, dropbox_url, ai_analysis')
    .eq('id', artworkId)
    .single()
  if (!data) throw new Error('Logo not found')
  if (!data.ai_analysis) data.ai_analysis = await analyzeArtwork(artworkId)
  return data
}

export async function loadStyleAndColor(db: Db, colorId: string): Promise<{ style: HatStyleRow; color: HatColorRow }> {
  const { data: color } = await db.from('hat_colors').select('*').eq('id', colorId).single<HatColorRow>()
  if (!color) throw new Error('Hat color not found')
  const { data: style } = await db.from('hat_styles').select('*').eq('id', color.style_id).single<HatStyleRow>()
  if (!style) throw new Error('Hat style not found')
  return { style, color }
}

export type RenderResult = {
  image: Buffer
  placement: Awaited<ReturnType<typeof composeMockup>>['placement']
  style: HatStyleRow
  color: HatColorRow
  method: string
  artworkName: string
  title: string
}

export async function renderMockup(
  db: Db,
  sel: { colorId: string; artworkId: string; method: string; heightIn?: number | null; offsetYIn?: number | null },
  outputWidth = 800,
): Promise<RenderResult> {
  const { style, color } = await loadStyleAndColor(db, sel.colorId)
  const artwork = await loadArtwork(db, sel.artworkId)
  const [blank, logo, rule] = await Promise.all([ensureBlankImage(db, style, color), loadLogoPng(artwork), getRule(db, sel.method)])
  const geometry = await getGeometry(db, style, color, blank)
  const { image, placement } = await composeMockup({
    blank,
    logo,
    geometry,
    rule,
    heightIn: sel.heightIn,
    offsetYIn: sel.offsetYIn,
    outputWidth,
  })
  return {
    image,
    placement,
    style,
    color,
    method: sel.method,
    artworkName: artwork.name,
    title: `${style.style_number} ${color.name} – ${artwork.name} – ${METHOD_LABELS[sel.method] ?? sel.method}`,
  }
}

export const toDataUrl = (buf: Buffer, type = 'image/jpeg') => `data:${type};base64,${buf.toString('base64')}`

/** Colors of a style ranked by how well the logo's colors stand out on them. */
export async function suggestColors(db: Db, styleId: string, artworkId: string | null, limit = 3) {
  const { data: colors } = await db.from('hat_colors').select('*').eq('style_id', styleId).eq('is_active', true)
  let logoColors: string[] = []
  if (artworkId) {
    const art = await loadArtwork(db, artworkId).catch(() => null)
    logoColors = art?.ai_analysis?.colors ?? []
  }
  const scored = (colors ?? []).map((c: HatColorRow) => {
    const hex = c.hex ?? '#808080'
    // The logo's least-visible color decides readability.
    const score = logoColors.length ? Math.min(...logoColors.map((l) => contrastRatio(l, hex))) : 1
    return { id: c.id, name: c.name, hex: c.hex, contrast: Math.round(score * 10) / 10 }
  })
  scored.sort((a, b) => b.contrast - a.contrast)
  return { total: scored.length, suggestions: scored.slice(0, limit), logoColors }
}
