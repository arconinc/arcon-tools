import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { composeMockup, placeLogo, type PlacementRule } from './compose'
import { computeGeometry, type Geometry } from './geometry'

const geometry: Geometry = {
  crown_top_y: 0.14,
  bill_seam_y: 0.69,
  crown_left_x: 0.1,
  crown_right_x: 0.89,
  center_x: 0.5,
  center_y: 0.44,
  px_per_inch: 157, // 0.55 * 1000 / 3.5
  confidence: 1,
}
const embroidery: PlacementRule = { method: 'embroidery', max_width_in: 4.5, max_height_in: 2.25, default_height_in: 2 }

describe('placeLogo', () => {
  it('uses the rule default height and converts inches to pixels', () => {
    const p = placeLogo(geometry, embroidery, 1, 1000, 1000)
    expect(p.heightIn).toBe(2)
    expect(p.height).toBe(314)
    expect(p.clamped).toBe(false)
  })

  it('clamps height to the rule maximum', () => {
    const p = placeLogo(geometry, embroidery, 1, 1000, 1000, 3)
    expect(p.heightIn).toBe(2.25)
    expect(p.clamped).toBe(true)
  })

  it('shrinks a wide logo to the max width and keeps its aspect', () => {
    const p = placeLogo(geometry, embroidery, 4, 1000, 1000, 2)
    expect(p.widthIn).toBe(4.5)
    expect(p.heightIn).toBeCloseTo(1.13, 2)
  })

  it('scales with output width', () => {
    const big = placeLogo(geometry, embroidery, 1, 1000, 1000)
    const small = placeLogo(geometry, embroidery, 1, 500, 500)
    expect(small.height).toBe(Math.round(big.height / 2))
  })

  it('never lets the logo cross the bill seam', () => {
    const p = placeLogo(geometry, embroidery, 1, 1000, 1000, 2, 5)
    expect(p.top + p.height).toBeLessThanOrEqual(0.69 * 1000)
    expect(p.clamped).toBe(true)
  })
})

describe('composeMockup', () => {
  it('renders a JPEG at the requested width', async () => {
    const blank = readFileSync(path.join(__dirname, '__fixtures__', '112_65.jpg'))
    const logo = await sharp(
      Buffer.from(
        '<svg width="300" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="400" fill="none"/>' +
          '<path d="M150 20 L280 110 L280 160 L150 70 L20 160 L20 110 Z" fill="#f26a21"/>' +
          '<text x="150" y="300" text-anchor="middle" font-family="Arial" font-weight="900" font-size="80" fill="#ffffff">RAPAL</text></svg>',
      ),
    )
      .png()
      .toBuffer()
    const g = await computeGeometry(blank, 'mid')
    for (const method of ['embroidery', 'leather_patch']) {
      const { image, size, placement } = await composeMockup({ blank, logo, geometry: g, rule: { ...embroidery, method }, outputWidth: 800 })
      const meta = await sharp(image).metadata()
      expect(meta.format).toBe('jpeg')
      expect(meta.width).toBe(800)
      expect(size.width).toBe(800)
      expect(placement.heightIn).toBeLessThanOrEqual(2.25)
      if (process.env.MOCKUP_PREVIEW_DIR) writeFileSync(path.join(process.env.MOCKUP_PREVIEW_DIR, `mockup-${method}.jpg`), image)
    }
  })
})
