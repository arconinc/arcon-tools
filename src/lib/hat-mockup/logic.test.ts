import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { hasSolidBackground } from '@/lib/artwork/logo'
import { describeSelectionChange } from './agent'
import { pixelDiff } from './realism'
import { decodeImageDataUrl, isRenderable, parseSelection } from './request'
import { priceAt } from './service'
import { fillTemplate, swapCustomer } from './starters'

const ID = '11111111-2222-3333-4444-555555555555'
const ID2 = '66666666-7777-8888-9999-000000000000'

describe('parseSelection', () => {
  it('keeps valid ids and drops junk', () => {
    expect(parseSelection({ colorId: ID, artworkId: 'nope', method: 'embroidery', heightIn: 2, offsetYIn: 9 })).toEqual({
      colorId: ID,
      method: 'embroidery',
      heightIn: 2,
    })
    expect(parseSelection({ method: 'tattoo' })).toEqual({})
    expect(parseSelection(null)).toEqual({})
  })

  it('needs color, logo and method to render', () => {
    expect(isRenderable({ colorId: ID, artworkId: ID2, method: 'printing' })).toBe(true)
    expect(isRenderable({ colorId: ID, method: 'printing' })).toBe(false)
  })
})

describe('decodeImageDataUrl', () => {
  it('accepts jpeg/png data URLs only', () => {
    expect(decodeImageDataUrl('data:image/png;base64,aGVsbG8=')?.toString()).toBe('hello')
    expect(decodeImageDataUrl('data:text/html;base64,aGVsbG8=')).toBeNull()
    expect(decodeImageDataUrl('https://example.com/x.png')).toBeNull()
  })
})

describe('starters', () => {
  it('fills {customer} or drops the starter when no customer', () => {
    expect(fillTemplate('Make a hat for {customer}', 'Rapal')).toBe('Make a hat for Rapal')
    expect(fillTemplate('Make a hat for {customer}', null)).toBeNull()
    expect(fillTemplate('Show me the 112 in charcoal', null)).toBe('Show me the 112 in charcoal')
  })

  it("swaps last time's customer for the current one", () => {
    expect(swapCustomer('Same as Rapal but navy', 'Rapal', 'Smith Farms')).toBe('Same as Smith Farms but navy')
    expect(swapCustomer('Same as Rapal but navy', 'Rapal', null)).toBe('Same as Rapal but navy')
    expect(swapCustomer('A.B. Co hat', 'A.B. Co', 'XYZ')).toBe('XYZ hat')
  })
})

describe('describeSelectionChange', () => {
  it('summarizes picker changes with names', () => {
    const note = describeSelectionChange({ colorId: ID, method: 'embroidery' }, { colorId: ID2, method: 'leather_patch' }, { [ID2]: 'Navy' })
    expect(note).toBe('[Selections changed with the pickers] color → Navy, method → Leather patch')
    expect(describeSelectionChange({ colorId: ID }, { colorId: ID }, {})).toBeNull()
  })
})

describe('priceAt', () => {
  const breaks = [
    { quantity: 1, price_cents: 3635 },
    { quantity: 50, price_cents: 2290 },
    { quantity: 100, price_cents: 1913 },
  ]
  it('uses the highest break at or below the quantity', () => {
    expect(priceAt(breaks, 1)).toBe(3635)
    expect(priceAt(breaks, 75)).toBe(2290)
    expect(priceAt(breaks, 500)).toBe(1913)
    expect(priceAt(null, 10)).toBeNull()
  })
})

describe('image checks', () => {
  const box = (bg: { r: number; g: number; b: number; alpha: number }) =>
    sharp({ create: { width: 100, height: 100, channels: 4, background: bg } })
      .composite([{ input: Buffer.from('<svg width="100" height="100"><circle cx="50" cy="50" r="30" fill="#f26a21"/></svg>') }])
      .png()
      .toBuffer()

  it('detects a solid background box but not a transparent logo', async () => {
    expect(await hasSolidBackground(await box({ r: 255, g: 255, b: 255, alpha: 1 }))).toBe(true)
    expect(await hasSolidBackground(await box({ r: 0, g: 0, b: 0, alpha: 0 }))).toBe(false)
  })

  it('pixelDiff is 0 for identical images and large for different ones', async () => {
    const white = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#ffffff' } }).png().toBuffer()
    const black = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#000000' } }).png().toBuffer()
    expect(await pixelDiff(white, white)).toBe(0)
    expect(await pixelDiff(white, black)).toBeGreaterThan(0.9)
  })
})
