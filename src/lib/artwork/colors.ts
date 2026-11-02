export type RgbColor = { r: number; g: number; b: number }

/**
 * Bucket-quantize a raw RGBA buffer into up to `maxColors` dominant colors.
 * Each pixel is snapped to the nearest `tolerance`-step grid point, then
 * buckets are ranked by pixel count. Near-white pixels are skipped because
 * they are almost always the background of a logo.
 */
export function quantizeColors(data: Buffer, maxColors = 8, tolerance = 32): RgbColor[] {
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

export function toHex({ r, g, b }: RgbColor): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}
