import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { computeGeometry, contrastRatio, geometriesAgree, isPlausible, mergeGeometry } from './geometry'

const fixture = (name: string) => readFileSync(path.join(__dirname, '__fixtures__', name))

describe('computeGeometry on Richardson 112 blanks', () => {
  it('finds the crown and bill seam in a plausible place', async () => {
    const g = await computeGeometry(fixture('112_65.jpg'), 'mid')
    expect(g.crown_top_y).toBeGreaterThan(0.05)
    expect(g.crown_top_y).toBeLessThan(0.3)
    expect(g.bill_seam_y).toBeGreaterThan(0.55)
    expect(g.bill_seam_y).toBeLessThan(0.8)
    expect(g.center_x).toBeGreaterThan(0.45)
    expect(g.center_x).toBeLessThan(0.55)
    expect(g.confidence).toBeGreaterThanOrEqual(0.6)
  })

  it('gives the same geometry for different colors of the same style', async () => {
    const [navy, charcoal, navyWhite] = await Promise.all(
      ['112_65.jpg', '112_10.jpg', '112_01.jpg'].map((f) => computeGeometry(fixture(f), 'mid')),
    )
    expect(geometriesAgree(navy, charcoal)).toBe(true)
    expect(mergeGeometry(navy, charcoal).needs_review).toBe(false)
    // White mesh is only a few levels off the white background but still has to be detected.
    expect(geometriesAgree(navy, navyWhite)).toBe(true)
  })

  it('scales px per inch by profile', async () => {
    const img = fixture('112_65.jpg')
    const mid = await computeGeometry(img, 'mid')
    const high = await computeGeometry(img, 'high')
    expect(high.px_per_inch).toBeLessThan(mid.px_per_inch)
  })
})

describe('computeGeometry on light hats', () => {
  it('measures a light rope cap instead of shrinking the crown to a sliver', async () => {
    const g = await computeGeometry(fixture('258r_67.jpg'), 'mid')
    expect(g.crown_right_x - g.crown_left_x).toBeGreaterThan(0.6)
    expect(g.center_x).toBeGreaterThan(0.45)
    expect(g.center_x).toBeLessThan(0.55)
    expect(g.bill_seam_y).toBeGreaterThan(0.55)
    expect(g.bill_seam_y).toBeLessThan(0.75)
  })

  it('falls back to standard framing when nothing can be measured', async () => {
    const white = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#ffffff' } }).jpeg().toBuffer()
    const g = await computeGeometry(white, 'mid')
    expect(isPlausible(g)).toBe(true)
    expect(g.confidence).toBe(0)
    expect(mergeGeometry(g, null).needs_review).toBe(true)
  })
})

describe('contrastRatio', () => {
  it('ranks white on navy above white on cream', () => {
    expect(contrastRatio('#ffffff', '#333e59')).toBeGreaterThan(contrastRatio('#ffffff', '#dfd5c7'))
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })
})
