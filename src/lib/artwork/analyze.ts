import * as Sentry from '@sentry/nextjs'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'
import { imageBlock, isClaudeConfigured, structuredCall } from '@/lib/ai/claude'
import { quantizeColors, toHex } from './colors'
import {
  canUseAsLogo,
  EMBROIDERY_WARNINGS,
  hasSolidBackground,
  logoPngUrl,
  type ArtworkAnalysis,
  type EmbroideryWarning,
  type LogoArtwork,
} from './logo'

const SYSTEM = `You review customer logo artwork before it is embroidered on a hat front (about 2 inches tall).
Flag only real problems from this list: tiny_text (text that would be under about 0.25 inch tall at that size),
fine_lines (strokes thinner than about 1mm at that size), gradient (color blends that thread can't reproduce),
too_many_colors (more than about 8 distinct thread colors), photo (a photograph rather than a logo).
Return an empty list for a clean, bold logo. Keep notes to one short sentence or leave it empty.`

const SCHEMA = {
  type: 'object',
  properties: {
    warnings: { type: 'array', items: { type: 'string', enum: [...EMBROIDERY_WARNINGS] } },
    notes: { type: 'string' },
  },
  required: ['warnings', 'notes'],
  additionalProperties: false,
}

/**
 * Analyzes a logo once and stores the result on crm_artwork.ai_analysis:
 * solid-background detection (for AI background removal), dominant colors,
 * and embroidery warnings from Claude vision. Never throws.
 */
export async function analyzeArtwork(artworkId: string): Promise<ArtworkAnalysis | null> {
  const db = createAdminClient()
  try {
    const { data: a } = await db
      .from('crm_artwork')
      .select('id, url, cloudinary_public_id, cloudinary_resource_type, is_drive_link, dropbox_url, ai_analysis')
      .eq('id', artworkId)
      .single<LogoArtwork>()
    if (!a) return null

    let analysis: ArtworkAnalysis
    if (!canUseAsLogo(a)) {
      analysis = { supported: false, analyzed_at: new Date().toISOString() }
    } else {
      const res = await fetch(logoPngUrl(a.url), { signal: AbortSignal.timeout(20_000) })
      if (!res.ok) throw new Error(`Cloudinary returned ${res.status} for artwork ${artworkId}`)
      const png = Buffer.from(await res.arrayBuffer())
      const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

      let warnings: EmbroideryWarning[] = []
      let notes = ''
      if (isClaudeConfigured()) {
        const small = await sharp(png).resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true }).png().toBuffer()
        const out = await structuredCall<{ warnings: EmbroideryWarning[]; notes: string }>({
          system: SYSTEM,
          content: [imageBlock(small), { type: 'text', text: 'Review this logo for hat embroidery.' }],
          schema: SCHEMA,
          maxTokens: 1000,
        })
        warnings = out.warnings.filter((w) => (EMBROIDERY_WARNINGS as readonly string[]).includes(w))
        notes = out.notes
      }

      analysis = {
        supported: true,
        has_background: await hasSolidBackground(png),
        colors: quantizeColors(data, 5, 32).map(toHex),
        warnings,
        notes,
        analyzed_at: new Date().toISOString(),
      }
    }

    await db.from('crm_artwork').update({ ai_analysis: analysis }).eq('id', artworkId)
    return analysis
  } catch (err) {
    Sentry.captureException(err)
    return null
  }
}
