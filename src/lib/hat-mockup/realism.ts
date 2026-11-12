import sharp from 'sharp'
import { imageBlock, isClaudeConfigured, structuredCall } from '@/lib/ai/claude'
import { cropPlacement, type Placement } from './compose'

// ponytail: one provider (Gemini image) wired so the bake-off can run in the app.
// If the bake-off picks Higgsfield instead, replace generateRealistic's body.
const GEMINI_MODEL = process.env.REALISM_MODEL || 'gemini-2.5-flash-image'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

export const PIXEL_DIFF_LIMIT = 0.2

export function isRealismConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY
}

const LOOK: Record<string, string> = {
  embroidery: 'raised thread embroidery with satin-stitch texture',
  printing: 'a screen print that sits in the fabric',
  leather_patch: 'a debossed leather patch stitched to the hat',
  printed_patch: 'a woven/printed patch stitched to the hat',
}

/** Turns the flat composite into a realistic render of the same mockup. */
export async function generateRealistic(flat: Buffer, method: string): Promise<Buffer> {
  const prompt =
    `Make the logo on this hat look like real ${LOOK[method] ?? 'decoration'}, following the curve of the crown and matching the hat's lighting. ` +
    'Do not change the logo: same shape, same letters, same spelling, same colors, same size and position. ' +
    "Do not change the hat, its color, the background, the framing, or the small text in the bottom-right corner."
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: flat.toString('base64') } }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`Image model returned HTTP ${res.status}`)
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] } }[]
  }
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data || p.inline_data?.data)
  const data = part?.inlineData?.data ?? part?.inline_data?.data
  if (!data) throw new Error('Image model returned no image')
  return Buffer.from(data, 'base64')
}

/** Mean absolute greyscale difference (0..1) between two images of the same region. */
export async function pixelDiff(a: Buffer, b: Buffer): Promise<number> {
  const meta = await sharp(a).metadata()
  const w = meta.width ?? 1
  const h = meta.height ?? 1
  const ra = await sharp(a).greyscale().raw().toBuffer()
  const rb = await sharp(b).resize(w, h, { fit: 'fill' }).greyscale().raw().toBuffer()
  let sum = 0
  for (let i = 0; i < ra.length; i++) sum += Math.abs(ra[i] - rb[i])
  return sum / ra.length / 255
}

export type Fidelity = {
  pass: boolean
  pixel_diff: number
  text_matches: boolean | null
  colors_match: boolean | null
  placement_ok: boolean | null
  notes: string
}

const FIDELITY_SCHEMA = {
  type: 'object',
  properties: {
    text_matches: { type: 'boolean' },
    colors_match: { type: 'boolean' },
    placement_ok: { type: 'boolean' },
    notes: { type: 'string' },
  },
  required: ['text_matches', 'colors_match', 'placement_ok', 'notes'],
  additionalProperties: false,
}

/**
 * Compares the logo area of the realistic render with the flat composite and
 * the original logo. Fails closed: anything unsure keeps the flat mockup.
 */
export async function checkFidelity({ flat, realistic, placement, logo }: { flat: Buffer; realistic: Buffer; placement: Placement; logo: Buffer }): Promise<Fidelity> {
  const flatMeta = await sharp(flat).metadata()
  const sized = await sharp(realistic).resize(flatMeta.width, flatMeta.height, { fit: 'fill' }).jpeg().toBuffer()
  const [flatCrop, realCrop] = await Promise.all([cropPlacement(flat, placement), cropPlacement(sized, placement)])
  const diff = Math.round((await pixelDiff(flatCrop, realCrop)) * 1000) / 1000

  if (!isClaudeConfigured()) {
    return { pass: false, pixel_diff: diff, text_matches: null, colors_match: null, placement_ok: null, notes: 'Vision check not configured' }
  }
  const smallLogo = await sharp(logo).resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true }).png().toBuffer()
  const v = await structuredCall<{ text_matches: boolean; colors_match: boolean; placement_ok: boolean; notes: string }>({
    system:
      'You check AI-rendered hat mockups for logo accuracy. Be strict: any changed, missing, added or misspelled letter means text_matches is false; a noticeably different hue means colors_match is false.',
    content: [
      { type: 'text', text: 'Image 1: the original logo.' },
      imageBlock(smallLogo),
      { type: 'text', text: 'Image 2: the logo area of the approved flat mockup.' },
      imageBlock(flatCrop),
      { type: 'text', text: 'Image 3: the same area after the realistic render. Does image 3 keep the logo from images 1 and 2?' },
      imageBlock(realCrop),
    ],
    schema: FIDELITY_SCHEMA,
    maxTokens: 800,
  })
  const pass = diff <= PIXEL_DIFF_LIMIT && v.text_matches && v.colors_match && v.placement_ok
  return { pass, pixel_diff: diff, ...v }
}
