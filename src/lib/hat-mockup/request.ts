import type { MockupSelection } from './service'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const METHODS = ['embroidery', 'printing', 'leather_patch', 'printed_patch'] as const

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Validates a selection sent by the browser. Unknown or malformed fields are dropped. */
export function parseSelection(raw: unknown): MockupSelection {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const sel: MockupSelection = {}
  if (isUuid(r.customerId)) sel.customerId = r.customerId
  if (isUuid(r.artworkId)) sel.artworkId = r.artworkId
  if (isUuid(r.styleId)) sel.styleId = r.styleId
  if (isUuid(r.colorId)) sel.colorId = r.colorId
  if (typeof r.method === 'string' && (METHODS as readonly string[]).includes(r.method)) sel.method = r.method
  const h = numOrNull(r.heightIn)
  if (h != null && h > 0 && h <= 6) sel.heightIn = h
  const o = numOrNull(r.offsetYIn)
  if (o != null && Math.abs(o) <= 3) sel.offsetYIn = o
  return sel
}

/** A render needs color, logo and method. */
export function isRenderable(sel: MockupSelection): sel is MockupSelection & { colorId: string; artworkId: string; method: string } {
  return !!sel.colorId && !!sel.artworkId && !!sel.method
}

const DATA_URL = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

export function decodeImageDataUrl(v: unknown): Buffer | null {
  if (typeof v !== 'string') return null
  const m = DATA_URL.exec(v)
  if (!m) return null
  const buf = Buffer.from(m[2], 'base64')
  return buf.length > 0 && buf.length <= MAX_IMAGE_BYTES ? buf : null
}
