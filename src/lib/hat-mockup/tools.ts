import type Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { canUseAsLogo, WARNING_LABELS, type ArtworkAnalysis } from '@/lib/artwork/logo'
import { METHOD_LABELS, priceAt, renderMockup, suggestColors, toDataUrl, type HatStyleRow, type MockupSelection } from './service'

type Db = ReturnType<typeof createAdminClient>

export type Preview = {
  id: string
  dataUrl: string
  title: string
  heightIn: number
  widthIn: number
  clamped: boolean
  selection: Required<Pick<MockupSelection, 'colorId' | 'artworkId' | 'method'>> & Pick<MockupSelection, 'heightIn' | 'offsetYIn' | 'styleId'>
}

export type AskOption = { label: string; value: string; hex?: string | null }
export type Ask = { question: string; options: AskOption[] }

export type ToolContext = {
  db: Db
  state: MockupSelection
  previews: Preview[]
  activity: string[]
}

const obj = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object' as const,
  properties,
  required,
  additionalProperties: false,
})
const str = { type: 'string' }
const num = { type: 'number' }

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'find_customer',
    description: 'Search CRM customers by name. Returns up to 5 matches with ids.',
    input_schema: obj({ query: str }, ['query']),
  },
  {
    name: 'list_customer_logos',
    description:
      "List a customer's logo artwork with ids, names, colors, whether it can go on a hat, and embroidery warnings. Pick the logo matching the request (e.g. 'vertical').",
    input_schema: obj({ customer_id: str }, ['customer_id']),
  },
  {
    name: 'list_customer_mockups',
    description: "A customer's saved hat mockups, newest first, with the hat, color, logo, decoration and size used. Use for 'same as last time' requests.",
    input_schema: obj({ customer_id: str, limit: num }, ['customer_id']),
  },
  {
    name: 'search_hats',
    description:
      'Search the saved hat catalog. All filters optional. Returns matching styles with ids, decoration methods and minimums, price at the quantity, profile, and color count. Never offer a hat that this tool did not return.',
    input_schema: obj(
      {
        text: { type: 'string', description: "Words to match in name, style number, details, or category, e.g. 'trucker', 'rope', '112', 'low profile'" },
        brand: str,
        method: { type: 'string', enum: Object.keys(METHOD_LABELS) },
        quantity: { type: 'number', description: 'Order quantity; filters by vendor minimum and prices at this quantity' },
        max_price_dollars: { type: 'number', description: 'Max blank+decoration price per hat at the quantity' },
      },
      [],
    ),
  },
  {
    name: 'get_hat',
    description: 'Full details for one hat style: colors (ids, names, swatch hex), decoration methods and minimums, price breaks, profile, details.',
    input_schema: obj({ style_id: str }, ['style_id']),
  },
  {
    name: 'find_colors',
    description: "Find colors of a style by name, e.g. 'navy', 'charcoal black'. Returns color ids.",
    input_schema: obj({ style_id: str, query: str }, ['style_id', 'query']),
  },
  {
    name: 'suggest_colors',
    description: "Colors of a style ranked by contrast with the logo's colors (best readability first).",
    input_schema: obj({ style_id: str, artwork_id: str, limit: num }, ['style_id']),
  },
  {
    name: 'render_mockup',
    description:
      'Render the mockup: logo on the hat color with a decoration method. Size is in inches and is clamped to Arcon placement rules; omit height_in to use the default size. offset_y_in moves the logo down (positive) or up (negative). The result reports the final size; tell the rep that size.',
    input_schema: obj({ color_id: str, artwork_id: str, method: { type: 'string', enum: Object.keys(METHOD_LABELS) }, height_in: num, offset_y_in: num }, [
      'color_id',
      'artwork_id',
      'method',
    ]),
  },
  {
    name: 'compare_mockups',
    description: 'Render the same logo on up to 3 hat colors side by side so the rep can compare.',
    input_schema: obj(
      { color_ids: { type: 'array', items: str, maxItems: 3 }, artwork_id: str, method: { type: 'string', enum: Object.keys(METHOD_LABELS) } },
      ['color_ids', 'artwork_id', 'method'],
    ),
  },
  {
    name: 'ask_user',
    description:
      'Ask the rep one question with clickable options, then wait for the answer. Use when a choice is needed. Options must come from tool results. Include hex for color options.',
    input_schema: obj(
      {
        question: str,
        options: {
          type: 'array',
          maxItems: 6,
          items: obj({ label: str, value: str, hex: str }, ['label', 'value']),
        },
      },
      ['question', 'options'],
    ),
  },
]

type Input = Record<string, unknown>
const s = (i: Input, k: string) => (typeof i[k] === 'string' && (i[k] as string).trim() ? (i[k] as string).trim() : null)
const n = (i: Input, k: string) => (typeof i[k] === 'number' && Number.isFinite(i[k]) ? (i[k] as number) : null)
const UUID = /^[0-9a-f-]{36}$/i
const need = (i: Input, k: string) => {
  const v = s(i, k)
  if (!v || !UUID.test(v)) throw new Error(`${k} must be an id returned by an earlier tool`)
  return v
}

type StyleWithJoins = HatStyleRow & {
  hat_decoration_methods: { method: string; minimum_quantity: number | null }[]
  hat_colors: { count: number }[]
}

async function searchHats(db: Db, i: Input) {
  const { data } = await db
    .from('hat_styles')
    .select('*, hat_decoration_methods(method, minimum_quantity), hat_colors(count)')
    .eq('is_active', true)
  const text = s(i, 'text')?.toLowerCase().split(/\s+/).filter(Boolean) ?? []
  const brand = s(i, 'brand')?.toLowerCase()
  const method = s(i, 'method')
  const qty = n(i, 'quantity')
  const maxCents = n(i, 'max_price_dollars') != null ? n(i, 'max_price_dollars')! * 100 : null

  const rows = ((data ?? []) as StyleWithJoins[]).filter((st) => {
    const hay = [st.name, st.style_number, st.silhouette, st.profile ? `${st.profile} profile` : '', ...(st.categories ?? []), ...(st.details ?? [])]
      .join(' ')
      .toLowerCase()
    if (text.some((t) => !hay.includes(t))) return false
    if (brand && st.brand.toLowerCase() !== brand) return false
    const m = method ? st.hat_decoration_methods.find((d) => d.method === method) : null
    if (method && !m) return false
    if (qty != null && m?.minimum_quantity && qty < m.minimum_quantity) return false
    if (maxCents != null && qty != null && (priceAt(st.price_breaks, qty) ?? Infinity) > maxCents) return false
    return true
  })

  return {
    count: rows.length,
    styles: rows.slice(0, 15).map((st) => ({
      style_id: st.id,
      brand: st.brand,
      style: st.style_number,
      name: st.name,
      silhouette: st.silhouette,
      profile: st.profile,
      methods: st.hat_decoration_methods.map((d) => ({ method: d.method, minimum: d.minimum_quantity })),
      price_each_dollars: qty != null ? (priceAt(st.price_breaks, qty) ?? 0) / 100 : undefined,
      colors: st.hat_colors?.[0]?.count ?? 0,
    })),
  }
}

async function renderOne(ctx: ToolContext, sel: { colorId: string; artworkId: string; method: string; heightIn?: number | null; offsetYIn?: number | null }) {
  const r = await renderMockup(ctx.db, sel)
  const id = `p${ctx.previews.length + 1}`
  ctx.previews.push({
    id,
    dataUrl: toDataUrl(r.image),
    title: r.title,
    heightIn: r.placement.heightIn,
    widthIn: r.placement.widthIn,
    clamped: r.placement.clamped,
    selection: { ...sel, styleId: r.style.id, heightIn: r.placement.heightIn, offsetYIn: r.placement.offsetYIn },
  })
  return { r, id }
}

export async function executeTool(ctx: ToolContext, name: string, input: Input): Promise<unknown> {
  const { db } = ctx
  switch (name) {
    case 'find_customer': {
      const q = s(input, 'query') ?? ''
      ctx.activity.push(`Searched customers for “${q}”`)
      const { data } = await db.from('crm_customers').select('id, name').ilike('name', `%${q}%`).order('name').limit(5)
      return { customers: data ?? [] }
    }
    case 'list_customer_logos': {
      const id = need(input, 'customer_id')
      const { data } = await db
        .from('crm_artwork')
        .select('id, name, description, url, cloudinary_public_id, cloudinary_resource_type, is_drive_link, dropbox_url, width, height, ai_analysis')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
      const { data: cust } = await db.from('crm_customers').select('name').eq('id', id).maybeSingle()
      ctx.state.customerId = id
      ctx.state.customerName = cust?.name ?? ctx.state.customerName
      ctx.activity.push(`Read artwork on ${cust?.name ?? 'customer'}`)
      return {
        logos: (data ?? []).map((a) => {
          const an = a.ai_analysis as ArtworkAnalysis | null
          return {
            artwork_id: a.id,
            name: a.name,
            description: a.description,
            orientation: a.width && a.height ? (a.height > a.width * 1.15 ? 'vertical' : a.width > a.height * 1.15 ? 'horizontal' : 'square') : 'unknown',
            usable_on_hat: canUseAsLogo(a),
            colors: an?.colors ?? [],
            embroidery_warnings: (an?.warnings ?? []).map((w) => WARNING_LABELS[w]),
          }
        }),
      }
    }
    case 'list_customer_mockups': {
      const id = need(input, 'customer_id')
      const { data } = await db
        .from('hat_mockups')
        .select('id, title, method, placement, artwork_id, hat_color_id, created_at, hat_colors(name, style_id)')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
        .limit(Math.min(10, n(input, 'limit') ?? 5))
      ctx.activity.push('Looked up saved mockups')
      return { mockups: data ?? [] }
    }
    case 'search_hats': {
      ctx.activity.push('Searched the hat catalog')
      return searchHats(db, input)
    }
    case 'get_hat': {
      const id = need(input, 'style_id')
      const { data: st } = await db.from('hat_styles').select('*, hat_decoration_methods(method, minimum_quantity)').eq('id', id).single()
      if (!st) throw new Error('Hat not found')
      const { data: colors } = await db.from('hat_colors').select('id, name, hex').eq('style_id', id).eq('is_active', true).order('name')
      ctx.state.styleId = id
      ctx.activity.push(`Loaded colors for ${st.style_number}`)
      return {
        style_id: st.id,
        style: st.style_number,
        name: st.name,
        profile: st.profile,
        silhouette: st.silhouette,
        details: st.details,
        methods: st.hat_decoration_methods,
        price_breaks: (st.price_breaks ?? []).map((b: { quantity: number; price_cents: number }) => ({ quantity: b.quantity, dollars: b.price_cents / 100 })),
        colors: (colors ?? []).map((c) => ({ color_id: c.id, name: c.name, hex: c.hex })),
      }
    }
    case 'find_colors': {
      const id = need(input, 'style_id')
      const words = (s(input, 'query') ?? '').toLowerCase().split(/[\s/,]+/).filter(Boolean)
      const { data } = await db.from('hat_colors').select('id, name, hex').eq('style_id', id).eq('is_active', true)
      const matches = (data ?? []).filter((c) => words.every((w) => c.name.toLowerCase().includes(w)))
      return { colors: matches.slice(0, 10).map((c) => ({ color_id: c.id, name: c.name, hex: c.hex })) }
    }
    case 'suggest_colors': {
      const styleId = need(input, 'style_id')
      const artworkId = s(input, 'artwork_id')
      ctx.activity.push('Checked thread contrast against the logo')
      const r = await suggestColors(db, styleId, artworkId && UUID.test(artworkId) ? artworkId : null, Math.min(6, n(input, 'limit') ?? 3))
      return { total_colors: r.total, logo_colors: r.logoColors, suggestions: r.suggestions.map((c) => ({ color_id: c.id, name: c.name, hex: c.hex, contrast: c.contrast })) }
    }
    case 'render_mockup': {
      const sel = {
        colorId: need(input, 'color_id'),
        artworkId: need(input, 'artwork_id'),
        method: s(input, 'method') ?? 'embroidery',
        heightIn: n(input, 'height_in'),
        offsetYIn: n(input, 'offset_y_in'),
      }
      const { r, id } = await renderOne(ctx, sel)
      Object.assign(ctx.state, { ...sel, styleId: r.style.id, heightIn: r.placement.heightIn, offsetYIn: r.placement.offsetYIn })
      ctx.activity.push(`Rendered ${r.title}`)
      return {
        preview_id: id,
        title: r.title,
        size_in: { height: r.placement.heightIn, width: r.placement.widthIn },
        clamped_to_rules: r.placement.clamped,
      }
    }
    case 'compare_mockups': {
      const ids = Array.isArray(input.color_ids) ? (input.color_ids as unknown[]).filter((x): x is string => typeof x === 'string' && UUID.test(x)).slice(0, 3) : []
      if (!ids.length) throw new Error('color_ids must be ids from get_hat or suggest_colors')
      const artworkId = need(input, 'artwork_id')
      const method = s(input, 'method') ?? 'embroidery'
      const out = []
      for (const colorId of ids) {
        const { r, id } = await renderOne(ctx, { colorId, artworkId, method })
        out.push({ preview_id: id, color: r.color.name, size_in: { height: r.placement.heightIn, width: r.placement.widthIn } })
      }
      ctx.activity.push(`Compared ${out.length} colors`)
      return { previews: out }
    }
    default:
      throw new Error(`Unknown tool ${name}`)
  }
}

export function parseAsk(input: Input): Ask {
  const options = Array.isArray(input.options) ? input.options : []
  return {
    question: s(input, 'question') ?? 'Which one?',
    options: options
      .filter((o): o is Input => !!o && typeof o === 'object')
      .map((o) => ({ label: s(o, 'label') ?? '', value: s(o, 'value') ?? s(o, 'label') ?? '', hex: s(o, 'hex') }))
      .filter((o) => o.label)
      .slice(0, 6),
  }
}
