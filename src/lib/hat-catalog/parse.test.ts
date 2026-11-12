import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { blankImageUrl, isAllowedUrl } from './config'
import { detectProfile, detectSilhouette, parseListing, parseProduct } from './parse'

const fixture = (name: string) => readFileSync(path.join(__dirname, '__fixtures__', name), 'utf8')

describe('parseListing', () => {
  it('finds all 31 Richardson trucker products from the anchors', () => {
    const items = parseListing(fixture('richardson-trucker-hats.html'), 'richardson')
    expect(items).toHaveLength(31)
    expect(items.map((i) => i.path)).toContain('/catalog/richardson/adjustable-snapback-trucker-cap/')
    expect(items.every((i) => i.url.startsWith('https://www.rushordertees.com/catalog/richardson/'))).toBe(true)
  })
})

describe('parseProduct', () => {
  const path112 = '/catalog/richardson/adjustable-snapback-trucker-cap/'
  const p = parseProduct(fixture('richardson-112.html'), path112)!

  it('reads the page product, not related products', () => {
    expect(p).not.toBeNull()
    expect(p.styleNumber).toBe('112')
    expect(p.name).toBe('Richardson Adjustable Snapback Trucker Cap')
    // Related products (e.g. 112PM) carry their own colors in the same payload.
    expect(p.colors.length).toBe(110)
    expect(new Set(p.colors.map((c) => c.code)).size).toBe(p.colors.length)
  })

  it('maps color codes and names the way the vendor does', () => {
    const biscuit = p.colors.find((c) => c.code === '89')
    expect(biscuit?.name).toBe('Biscuit/ True Blue')
    expect(biscuit?.hex).toBe('#E2BE5A')
    expect(p.defaultColorCode).toBe('89')
    expect(blankImageUrl(p.styleNumber, '89')).toBe('https://img.rushordertees.com/modelImages/112_89_fr.jpg')
  })

  it('reads decoration methods with minimums, price breaks, profile and category', () => {
    expect(p.methods).toEqual([
      { method: 'embroidery', minimumQuantity: 6 },
      { method: 'printing', minimumQuantity: 1 },
    ])
    expect(p.priceBreaks[0]).toEqual({ quantity: 1, price_cents: 3635 })
    expect(p.priceBreaks.at(-1)).toEqual({ quantity: 500, price_cents: 1627 })
    expect(p.profile).toBe('mid')
    expect(p.silhouette).toBe('6-panel')
    expect(p.categories).toEqual(['trucker'])
    expect(p.sizes).toBe('ONE SIZE')
  })

  it('returns null when the page product is missing', () => {
    expect(parseProduct(fixture('richardson-112.html'), '/catalog/richardson/not-this-page/')).toBeNull()
    expect(parseProduct('<html></html>', path112)).toBeNull()
  })
})

describe('text detectors', () => {
  it('detects profile and silhouette', () => {
    expect(detectProfile('Structured, six-panel, low-profile')).toBe('low')
    expect(detectProfile('Richardson Low Pro Trucker Cap')).toBe('low')
    expect(detectProfile('no profile here')).toBeNull()
    expect(detectSilhouette('Five Panel Trucker with Rope Cap')).toBe('rope')
    expect(detectSilhouette('Five Panel Champ Trucker')).toBe('5-panel')
    expect(detectSilhouette('Seven Panel Trucker Cap')).toBe('7-panel')
  })
})

describe('isAllowedUrl', () => {
  it('only allows vendor hosts and never the designer', () => {
    expect(isAllowedUrl('https://www.rushordertees.com/catalog/richardson/x/')).toBe(true)
    expect(isAllowedUrl('https://img.rushordertees.com/modelImages/112_89_fr.jpg')).toBe(true)
    expect(isAllowedUrl('https://www.rushordertees.com/design/?x=1')).toBe(false)
    expect(isAllowedUrl('https://cdn.rushordertees.com/design/resources/scripts/ZoomImage.php')).toBe(false)
    expect(isAllowedUrl('https://evil.example.com/')).toBe(false)
    expect(isAllowedUrl('http://www.rushordertees.com/')).toBe(false)
  })
})
