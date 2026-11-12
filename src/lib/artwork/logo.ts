import sharp from 'sharp'
import type { ArtworkAnalysis } from './warnings'

export { EMBROIDERY_WARNINGS, WARNING_LABELS, type ArtworkAnalysis, type EmbroideryWarning } from './warnings'

export type LogoArtwork = {
  id: string
  url: string
  cloudinary_public_id: string | null
  cloudinary_resource_type: string | null
  is_drive_link: boolean
  dropbox_url: string | null
  ai_analysis: ArtworkAnalysis | null
}

/** Only uploaded Cloudinary images (incl. PDFs Cloudinary rasterizes) can go on a hat. */
export function canUseAsLogo(a: Pick<LogoArtwork, 'is_drive_link' | 'dropbox_url' | 'cloudinary_public_id' | 'cloudinary_resource_type'>): boolean {
  return !a.is_drive_link && !a.dropbox_url && !!a.cloudinary_public_id && a.cloudinary_resource_type === 'image'
}

const BASE_TRANSFORM = 'pg_1,w_1200,c_limit,f_png'

export function logoPngUrl(url: string, background: 'keep' | 'ai' | 'white' = 'keep'): string {
  const pre = background === 'ai' ? 'e_background_removal/' : background === 'white' ? 'e_make_transparent:12/' : ''
  return url.replace('/upload/', `/upload/${pre}${BASE_TRANSFORM}/`)
}

async function fetchPng(url: string): Promise<Buffer | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) return null // 423 = Cloudinary still processing the AI removal
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Logo as a transparent PNG. Logos with a solid background go through
 * Cloudinary's AI background removal; while that's still processing (or the
 * add-on isn't enabled), fall back to removing near-white pixels.
 */
export async function loadLogoPng(a: LogoArtwork): Promise<Buffer> {
  if (!canUseAsLogo(a)) throw new Error('This artwork is a link, not an uploaded image, so it cannot go on a hat.')
  if (a.ai_analysis?.has_background) {
    const removed = (await fetchPng(logoPngUrl(a.url, 'ai'))) ?? (await fetchPng(logoPngUrl(a.url, 'white')))
    if (removed) return removed
  }
  const plain = await fetchPng(logoPngUrl(a.url))
  if (!plain) throw new Error('Could not load the logo from Cloudinary.')
  return plain
}

/** True when all four corners are opaque and the same color (a background box). */
export async function hasSolidBackground(png: Buffer): Promise<boolean> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const n = Math.max(3, Math.round(Math.min(width, height) * 0.02))
  const samples: number[][] = []
  for (const [cx, cy] of [[0, 0], [width - n, 0], [0, height - n], [width - n, height - n]]) {
    for (let y = cy; y < cy + n; y++) {
      for (let x = cx; x < cx + n; x++) {
        const i = (y * width + x) * 4
        samples.push([data[i], data[i + 1], data[i + 2], data[i + 3]])
      }
    }
  }
  if (samples.some((s) => s[3] < 250)) return false
  const [r0, g0, b0] = samples[0]
  return samples.every(([r, g, b]) => Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0) < 30)
}
