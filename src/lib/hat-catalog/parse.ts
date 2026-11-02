import * as cheerio from 'cheerio'
import { SITE_ORIGIN } from './config'

export type ListingItem = { path: string; url: string }

export type ParsedColor = { code: string; name: string; hex: string | null; hexSecondary: string | null }
export type ParsedMethod = { method: string; minimumQuantity: number | null }
export type ParsedProduct = {
  styleNumber: string
  name: string
  path: string
  url: string
  categories: string[]
  sizes: string | null
  profile: 'low' | 'mid' | 'high' | null
  silhouette: string
  details: string[]
  priceBreaks: { quantity: number; price_cents: number }[]
  defaultColorCode: string | null
  colors: ParsedColor[]
  methods: ParsedMethod[]
}

const PRODUCT_PATH = /^\/catalog\/[a-z0-9-]+\/[a-z0-9-]+\/$/

/**
 * Product links on a brand/category listing page. The page's JSON-LD ItemList
 * only carries the first ~11 products, so read the anchors instead.
 */
export function parseListing(html: string, brandSlug?: string): ListingItem[] {
  const $ = cheerio.load(html)
  const seen = new Map<string, ListingItem>()
  $('a[href^="/catalog/"]').each((_, el) => {
    const path = $(el).attr('href') ?? ''
    if (!PRODUCT_PATH.test(path)) return
    if (brandSlug && path.split('/')[2] !== brandSlug) return
    if (!seen.has(path)) seen.set(path, { path, url: SITE_ORIGIN + path })
  })
  return [...seen.values()]
}

/** Joins the Next.js flight payload chunks (`self.__next_f.push([1,"..."])`) into one string. */
export function extractFlightPayload(html: string): string {
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g
  let out = ''
  for (const m of html.matchAll(re)) {
    try {
      out += JSON.parse(`"${m[1]}"`) as string
    } catch {
      // skip a chunk we can't decode; the product object lives in one chunk set
    }
  }
  return out
}

/** Index just past the `}` that closes the `{` at `start`, or -1. String-aware. */
function matchBrace(s: string, start: number): number {
  let depth = 0
  let inStr = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (c === '\\') i++
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return i + 1
  }
  return -1
}

type RawProduct = {
  style?: string
  decorationMethods?: { decorationMethod?: { title?: string; designStudioReference?: string }; minimumQuantity?: number }[]
  productVariants?: { variantColor?: { code?: string; name?: string; palette?: string[] } }[]
  breadcrumbs?: { slug?: string; title?: string; parent?: unknown }
  details?: { children?: { text?: string }[] }[]
  priceQuotes?: { quantity?: number; price?: number }[]
  sizeRange?: { smallest?: { name?: string }; largest?: { name?: string } }
  productImageData?: { defaultColorCode?: string }
  minimumQuantity?: number
}

/** The page's own product: the object with `decorationMethods` whose breadcrumb slug is this page. */
function findProductObject(payload: string, path: string): RawProduct | null {
  for (const m of payload.matchAll(/"decorationMethods"/g)) {
    const pos = m.index!
    let j = pos
    while (j > 0) {
      j = payload.lastIndexOf('{', j - 1)
      if (j < 0) break
      const end = matchBrace(payload, j)
      if (end <= pos) continue
      let obj: unknown
      try {
        obj = JSON.parse(payload.slice(j, end))
      } catch {
        continue
      }
      const p = obj as RawProduct
      if (p && typeof p === 'object' && p.style && p.productVariants && p.breadcrumbs?.slug === path) return p
      break // enclosing object isn't the product; try the next anchor
    }
  }
  return null
}

const METHOD_BY_REF: Record<string, string> = { emb: 'embroidery', scr: 'printing' }

function breadcrumbTrail(b: RawProduct['breadcrumbs']): { slug: string; title: string }[] {
  const out: { slug: string; title: string }[] = []
  let cur = b as { slug?: string; title?: string; parent?: unknown } | null | undefined
  while (cur) {
    if (cur.slug && cur.title) out.unshift({ slug: cur.slug, title: cur.title })
    cur = cur.parent as typeof cur
  }
  return out
}

export function detectProfile(text: string): 'low' | 'mid' | 'high' | null {
  const m = text.toLowerCase().match(/\b(low|mid|high)[\s-]?(pro|profile)\b/)
  return m ? (m[1] as 'low' | 'mid' | 'high') : null
}

export function detectSilhouette(text: string): string {
  const t = text.toLowerCase()
  if (/\brope\b/.test(t)) return 'rope'
  if (/five[\s-]panel|5[\s-]panel/.test(t)) return '5-panel'
  if (/seven[\s-]panel|7[\s-]panel/.test(t)) return '7-panel'
  if (/flat[\s-]bill/.test(t)) return 'flat-bill'
  return '6-panel'
}

export function parseProduct(html: string, path: string): ParsedProduct | null {
  const raw = findProductObject(extractFlightPayload(html), path)
  if (!raw?.style) return null

  const trail = breadcrumbTrail(raw.breadcrumbs)
  const name = trail.at(-1)?.title ?? raw.style
  const details = (raw.details ?? [])
    .flatMap((b) => (b.children ?? []).map((c) => c.text?.trim() ?? ''))
    .filter(Boolean)
  const text = [name, ...details].join(' ')

  const colors: ParsedColor[] = []
  const seenCodes = new Set<string>()
  for (const v of raw.productVariants ?? []) {
    const c = v.variantColor
    if (!c?.code || !c.name || seenCodes.has(c.code)) continue
    seenCodes.add(c.code)
    colors.push({ code: c.code, name: c.name, hex: c.palette?.[0] ?? null, hexSecondary: c.palette?.[1] ?? null })
  }

  const methods: ParsedMethod[] = []
  for (const d of raw.decorationMethods ?? []) {
    const ref = d.decorationMethod?.designStudioReference ?? ''
    const method =
      METHOD_BY_REF[ref] ??
      (d.decorationMethod?.title ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_')
    if (method) methods.push({ method, minimumQuantity: d.minimumQuantity ?? null })
  }
  // Patch hats are separate products on the vendor site, not decoration methods.
  if (path.includes('leather-patch')) methods.push({ method: 'leather_patch', minimumQuantity: raw.minimumQuantity ?? null })
  else if (/-patch\/$/.test(path)) methods.push({ method: 'printed_patch', minimumQuantity: raw.minimumQuantity ?? null })

  const small = raw.sizeRange?.smallest?.name
  const large = raw.sizeRange?.largest?.name

  return {
    styleNumber: raw.style,
    name,
    path,
    url: SITE_ORIGIN + path,
    categories: trail
      .map((t) => t.slug)
      .filter((s) => s !== path && s !== '/catalog/' && s !== '/hats/')
      .map((s) => s.replace(/^\/|\/$/g, '').split('/').pop()!),
    sizes: small && large ? (small === large ? small : `${small} - ${large}`) : null,
    profile: detectProfile(text),
    silhouette: detectSilhouette(text),
    details,
    priceBreaks: (raw.priceQuotes ?? [])
      .filter((q) => typeof q.quantity === 'number' && typeof q.price === 'number')
      .map((q) => ({ quantity: q.quantity!, price_cents: q.price! }))
      .sort((a, b) => a.quantity - b.quantity),
    defaultColorCode: raw.productImageData?.defaultColorCode ?? null,
    colors,
    methods,
  }
}
