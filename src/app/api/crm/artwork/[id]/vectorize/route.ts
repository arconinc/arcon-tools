import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import sharp from 'sharp'

// Use require() to avoid ESM/CJS interop issues with potrace's internal instanceof checks
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { trace } = require('potrace') as typeof import('potrace')

type Params = { params: Promise<{ id: string }> }
type RgbColor = { r: number; g: number; b: number }

// ---------------------------------------------------------------------------
// Color quantization
// ---------------------------------------------------------------------------

/**
 * Bucket-quantize a raw RGBA buffer into up to `maxColors` dominant colors.
 * Each pixel is snapped to the nearest `tolerance`-step grid point, then
 * buckets are ranked by pixel count. Near-white pixels are skipped because
 * they are almost always the background of a logo.
 */
function quantizeColors(data: Buffer, maxColors = 8, tolerance = 32): RgbColor[] {
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>()

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    if (a < 128) continue                        // transparent → background
    if (r > 240 && g > 240 && b > 240) continue // near-white  → background

    const qr = Math.round(r / tolerance) * tolerance
    const qg = Math.round(g / tolerance) * tolerance
    const qb = Math.round(b / tolerance) * tolerance
    const key = `${qr},${qg},${qb}`

    const bucket = buckets.get(key)
    if (bucket) {
      bucket.r += r; bucket.g += g; bucket.b += b; bucket.count++
    } else {
      buckets.set(key, { r, g, b, count: 1 })
    }
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors)
    .map(({ r, g, b, count }) => ({
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count),
    }))
}

// ---------------------------------------------------------------------------
// Mask creation
// ---------------------------------------------------------------------------

/**
 * Return a PNG where pixels within Euclidean `tolerance` of `target` are
 * black and all other pixels are white. potrace traces black-on-white.
 */
async function createColorMaskPng(
  data: Buffer,
  width: number,
  height: number,
  target: RgbColor,
  tolerance = 40,
): Promise<Buffer> {
  // Allocate a white RGB buffer (3 channels — no alpha needed for potrace)
  const maskData = Buffer.alloc(width * height * 3, 255)

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3]
    if (a < 128) continue // transparent → stays white

    const dist = Math.sqrt(
      (r - target.r) ** 2 + (g - target.g) ** 2 + (b - target.b) ** 2,
    )
    if (dist <= tolerance) {
      maskData[i * 3] = 0; maskData[i * 3 + 1] = 0; maskData[i * 3 + 2] = 0
    }
  }

  return sharp(maskData, { raw: { width, height, channels: 3 } }).png().toBuffer()
}

// ---------------------------------------------------------------------------
// potrace helpers
// ---------------------------------------------------------------------------

function traceBuffer(buf: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    trace(
      buf,
      {
        threshold: 128,
        // alphaMax 1.0 → potrace fits Bezier curves for smooth sections while
        // still detecting genuinely sharp corners.
        alphaMax: 1.0,
        // optTolerance 0.4 → simplifies curves without losing shape accuracy.
        optTolerance: 0.4,
      },
      (err: Error | null, svg: string) => {
        if (err) reject(err)
        else resolve(svg)
      },
    )
  })
}

/** Pull every `d="…"` attribute out of a potrace SVG string. */
function extractPaths(svg: string): string[] {
  return [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => m[1])
}

// ---------------------------------------------------------------------------
// SVG path → PostScript conversion
// ---------------------------------------------------------------------------

/**
 * Convert an SVG path `d` attribute to PostScript path commands.
 * potrace only emits absolute M, L, C, Z — no other commands needed.
 * Implicit repeated coordinate pairs after a command letter are handled.
 */
function svgPathToPs(d: string): string {
  const tokens = d
    .replace(/([MLCZmlcz])/g, ' $1 ')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)

  const ps: string[] = []
  let i = 0
  let lastCmd = ''

  while (i < tokens.length) {
    const tok = tokens[i]
    const isCmd = /^[MLCZmlcz]$/.test(tok)

    if (isCmd) {
      lastCmd = tok.toUpperCase()
      i++
      continue
    }

    switch (lastCmd) {
      case 'M': {
        const x = tokens[i++], y = tokens[i++]
        ps.push(`${x} ${y} moveto`)
        lastCmd = 'L' // implicit pairs after M are lineto
        break
      }
      case 'L': {
        const x = tokens[i++], y = tokens[i++]
        ps.push(`${x} ${y} lineto`)
        break
      }
      case 'C': {
        const x1 = tokens[i++], y1 = tokens[i++]
        const x2 = tokens[i++], y2 = tokens[i++]
        const x  = tokens[i++], y  = tokens[i++]
        ps.push(`${x1} ${y1} ${x2} ${y2} ${x} ${y} curveto`)
        break
      }
      case 'Z':
        ps.push('closepath')
        break
      default:
        i++
    }
  }

  return ps.join('\n')
}

// ---------------------------------------------------------------------------
// EPS builder
// ---------------------------------------------------------------------------

/**
 * Build an EPS document from one or more colored path layers.
 * Each layer gets its own `setrgbcolor` call before its paths are filled,
 * so the final EPS is fully color-accurate. Layers are drawn largest-area
 * first (they naturally come first from the quantizer), so smaller detail
 * colors paint on top.
 */
function buildEps(width: number, height: number, layers: Array<{ color: RgbColor; paths: string[] }>): string {
  const colorBlocks = layers.flatMap(({ color, paths }) => {
    if (paths.length === 0) return []
    const r = (color.r / 255).toFixed(4)
    const g = (color.g / 255).toFixed(4)
    const b = (color.b / 255).toFixed(4)
    return [
      `${r} ${g} ${b} setrgbcolor`,
      ...paths.map(d => ['newpath', svgPathToPs(d), 'eofill'].join('\n')),
    ]
  })

  return [
    '%!PS-Adobe-3.0 EPSF-3.0',
    `%%BoundingBox: 0 0 ${Math.ceil(width)} ${Math.ceil(height)}`,
    '%%EndComments',
    'gsave',
    // Flip coordinate system: SVG y=0 is top; PostScript y=0 is bottom
    `0 ${height} translate`,
    '1 -1 scale',
    ...colorBlocks,
    'grestore',
    '%%EOF',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

// GET /api/crm/artwork/[id]/vectorize
export async function GET(_req: NextRequest, { params }: Params) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: artwork, error } = await adminClient
    .from('crm_artwork')
    .select('url, name, is_drive_link, cloudinary_resource_type, mime_type')
    .eq('id', id)
    .single()

  if (error || !artwork) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (artwork.is_drive_link || artwork.cloudinary_resource_type !== 'image') {
    return NextResponse.json(
      { error: 'Vectorize is only supported for uploaded images' },
      { status: 400 },
    )
  }

  try {
    // Force PNG and cap width at 1200px — enough detail for potrace without
    // creating excessive anchor points from ultra-high-resolution noise.
    const pngUrl = artwork.url.replace('/upload/', '/upload/w_1200,c_scale,f_png/')

    const imgRes = await fetch(pngUrl)
    if (!imgRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch image from Cloudinary' }, { status: 502 })
    }
    const rawBuffer = Buffer.from(await imgRes.arrayBuffer())

    // Decode to raw RGBA so we can analyse individual pixel colors
    const { data: rgbaData, info } = await sharp(rawBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const { width, height } = info

    // Quantize to up to 8 dominant colors (skipping near-white background)
    const palette = quantizeColors(rgbaData, 8, 32)

    if (palette.length === 0) {
      // Fully white / transparent image — fall back to a single black pass
      palette.push({ r: 0, g: 0, b: 0 })
    }

    // Trace each color separately and collect colored path layers
    const layers: Array<{ color: RgbColor; paths: string[] }> = []

    for (const color of palette) {
      const maskPng = await createColorMaskPng(rgbaData, width, height, color, 40)
      const svg = await traceBuffer(maskPng)
      const paths = extractPaths(svg)
      if (paths.length > 0) {
        layers.push({ color, paths })
      }
    }

    if (layers.length === 0) {
      return NextResponse.json({ error: 'No traceable paths found in image' }, { status: 422 })
    }

    const eps = buildEps(width, height, layers)
    const safeName = (artwork.name ?? 'artwork').replace(/[^\w\s-]/g, '').trim() || 'artwork'

    return new Response(eps, {
      status: 200,
      headers: {
        'Content-Type': 'application/postscript',
        'Content-Disposition': `attachment; filename="${safeName}.eps"`,
      },
    })
  } catch (err) {
    console.error('[vectorize] error:', err)
    return NextResponse.json(
      { error: 'Vectorization failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
