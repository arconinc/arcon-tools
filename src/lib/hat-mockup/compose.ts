import sharp from 'sharp'
import type { Geometry } from './geometry'

export type PlacementRule = {
  method: string
  max_width_in: number
  max_height_in: number
  default_height_in: number
}

export type Placement = {
  /** Logo box in source-image pixels. */
  left: number
  top: number
  width: number
  height: number
  /** Final size after clamping, in inches. */
  heightIn: number
  widthIn: number
  offsetYIn: number
  clamped: boolean
}

const MARGIN_IN = 0.2 // keep the logo this far from the crown top and the bill seam

/**
 * Pure size math: where a logo of `aspect` (w/h) lands on a hat image of
 * `imgW` x `imgH`, clamped to the decoration rule and the hat's crown.
 */
export function placeLogo(
  geometry: Geometry,
  rule: PlacementRule,
  aspect: number,
  imgW: number,
  imgH: number,
  heightIn?: number | null,
  offsetYIn?: number | null,
): Placement {
  const ppi = geometry.px_per_inch * (imgW / 1000)
  const requested = heightIn ?? rule.default_height_in
  let hIn = Math.min(requested, rule.max_height_in)
  let wIn = hIn * aspect

  const crownWIn = ((geometry.crown_right_x - geometry.crown_left_x) * imgW * 0.9) / ppi
  const crownHIn = ((geometry.bill_seam_y - geometry.crown_top_y) * imgH) / ppi - 2 * MARGIN_IN
  const maxWIn = Math.min(rule.max_width_in, crownWIn)
  if (wIn > maxWIn) {
    wIn = maxWIn
    hIn = wIn / aspect
  }
  if (hIn > crownHIn) {
    hIn = crownHIn
    wIn = hIn * aspect
  }

  const w = Math.round(wIn * ppi)
  const h = Math.round(hIn * ppi)
  const cx = geometry.center_x * imgW
  let cy = geometry.center_y * imgH + (offsetYIn ?? 0) * ppi

  const minTop = geometry.crown_top_y * imgH + MARGIN_IN * ppi
  const maxBottom = geometry.bill_seam_y * imgH - MARGIN_IN * ppi
  cy = Math.max(minTop + h / 2, Math.min(maxBottom - h / 2, cy))

  const finalOffset = (cy - geometry.center_y * imgH) / ppi
  return {
    left: Math.round(cx - w / 2),
    top: Math.round(cy - h / 2),
    width: w,
    height: h,
    heightIn: round2(hIn),
    widthIn: round2(wIn),
    offsetYIn: round2(finalOffset),
    clamped: round2(hIn) !== round2(requested) || round2(finalOffset) !== round2(offsetYIn ?? 0),
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Diagonal satin-stitch shading so flat artwork reads as thread. */
async function embroider(logo: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.from(data)
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4
      if (out[i + 3] === 0) continue
      const f = (x + y) % 4 < 2 ? 1.06 : 0.9
      out[i] = Math.min(255, out[i] * f)
      out[i + 1] = Math.min(255, out[i + 1] * f)
      out[i + 2] = Math.min(255, out[i + 2] * f)
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).blur(0.4).png().toBuffer()
}

/** Soft drop shadow from the logo's alpha channel. */
async function shadowOf(logo: Buffer, w: number, h: number, opacity: number): Promise<Buffer> {
  const alpha = await sharp(logo).ensureAlpha().extractChannel(3).linear(opacity, 0).blur(1.5).toBuffer()
  return sharp({ create: { width: w, height: h, channels: 3, background: '#000000' } })
    .joinChannel(alpha)
    .png()
    .toBuffer()
}

function patchSvg(w: number, h: number, method: string): Buffer {
  const leather = method === 'leather_patch'
  const fill = leather ? '#8a5a35' : '#f4f1ea'
  const stroke = leather ? '#5e3b20' : '#b9b2a4'
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="${Math.round(h * 0.18)}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>` +
      `<rect x="9" y="9" width="${w - 18}" height="${h - 18}" rx="${Math.round(h * 0.14)}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-dasharray="5 4"/>` +
      `</svg>`,
  )
}

function watermarkSvg(w: number, h: number): Buffer {
  const size = Math.max(11, Math.round(w * 0.018))
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<text x="${w - 12}" y="${h - 12}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="${size}" fill="#94a3b8" letter-spacing="1">MOCKUP, NOT A PRODUCTION PROOF</text>` +
      `</svg>`,
  )
}

export type ComposeInput = {
  blank: Buffer
  logo: Buffer // PNG with transparent background
  geometry: Geometry
  rule: PlacementRule
  heightIn?: number | null
  offsetYIn?: number | null
  outputWidth?: number
}

/** Places the logo on the blank and returns a JPEG plus where it landed. */
export async function composeMockup({ blank, logo, geometry, rule, heightIn, offsetYIn, outputWidth = 800 }: ComposeInput) {
  const base = sharp(blank).resize({ width: outputWidth })
  const meta = await base.clone().metadata()
  const imgW = outputWidth
  const imgH = Math.round(((meta.height ?? outputWidth) * outputWidth) / (meta.width ?? outputWidth))

  const trimmed = await sharp(logo).ensureAlpha().trim().png().toBuffer()
  const lm = await sharp(trimmed).metadata()
  const aspect = (lm.width ?? 1) / (lm.height ?? 1)

  const method = rule.method
  const isPatch = method === 'leather_patch' || method === 'printed_patch'
  const p = placeLogo(geometry, rule, aspect, imgW, imgH, heightIn, offsetYIn)

  const layers: sharp.OverlayOptions[] = []
  let art = await sharp(trimmed).resize({ width: p.width, height: p.height, fit: 'inside' }).png().toBuffer()
  const am = await sharp(art).metadata()
  const aw = am.width ?? p.width
  const ah = am.height ?? p.height
  let artLeft = p.left + Math.round((p.width - aw) / 2)
  let artTop = p.top + Math.round((p.height - ah) / 2)

  if (isPatch) {
    // Patch shape is the decoration area; the logo sits inside it with padding.
    const patch = patchSvg(p.width, p.height, method)
    layers.push({ input: await shadowOf(await sharp(patch).png().toBuffer(), p.width, p.height, 0.45), left: p.left + 2, top: p.top + 3 })
    layers.push({ input: patch, left: p.left, top: p.top })
    art = await sharp(art).resize({ width: Math.round(aw * 0.72), height: Math.round(ah * 0.72), fit: 'inside' }).png().toBuffer()
    const im = await sharp(art).metadata()
    artLeft = p.left + Math.round((p.width - (im.width ?? 0)) / 2)
    artTop = p.top + Math.round((p.height - (im.height ?? 0)) / 2)
    if (method === 'leather_patch') {
      // Debossed look: logo shape pressed into the leather in a darker tone.
      const alpha = await sharp(art).ensureAlpha().extractChannel(3).toBuffer()
      art = await sharp({ create: { width: im.width ?? 1, height: im.height ?? 1, channels: 3, background: '#4a2c16' } })
        .joinChannel(alpha)
        .png()
        .toBuffer()
    }
  } else if (method === 'embroidery') {
    art = await embroider(art)
    const sm = await sharp(art).metadata()
    layers.push({ input: await shadowOf(art, sm.width ?? aw, sm.height ?? ah, 0.55), left: artLeft + 1, top: artTop + 2 })
  }
  layers.push({ input: art, left: artLeft, top: artTop })
  layers.push({ input: watermarkSvg(imgW, imgH), left: 0, top: 0 })

  const image = await base.composite(layers).jpeg({ quality: 86 }).toBuffer()
  return { image, placement: p, size: { width: imgW, height: imgH } }
}

/** Crop of the decoration area, for the fidelity check. */
export async function cropPlacement(image: Buffer, p: Placement, pad = 0.15): Promise<Buffer> {
  const meta = await sharp(image).metadata()
  const W = meta.width ?? 0
  const H = meta.height ?? 0
  const px = Math.round(p.width * pad)
  const py = Math.round(p.height * pad)
  const left = Math.max(0, p.left - px)
  const top = Math.max(0, p.top - py)
  return sharp(image)
    .extract({ left, top, width: Math.min(W - left, p.width + 2 * px), height: Math.min(H - top, p.height + 2 * py) })
    .png()
    .toBuffer()
}
