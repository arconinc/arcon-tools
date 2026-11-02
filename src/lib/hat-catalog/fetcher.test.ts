import { describe, expect, it } from 'vitest'
import { MAX_DELAY_MS, MIN_DELAY_MS } from './config'
import { BudgetExhausted, createPoliteFetcher, isDisallowed, nextDelay, parseRobots, RateLimited } from './fetcher'

function fakeClock() {
  let t = 1_000_000
  const sleeps: number[] = []
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms)
      t += ms
    },
    sleeps,
  }
}

const okFetch = (status = 200, headers: Record<string, string> = {}) =>
  (async (url: string) => ({ status, url, headers: new Headers(headers), text: async () => 'ok', arrayBuffer: async () => new ArrayBuffer(0) })) as unknown as typeof fetch

const URL_A = 'https://www.rushordertees.com/catalog/richardson/a/'

describe('createPoliteFetcher', () => {
  it('waits at least 5 seconds between requests', async () => {
    const clock = fakeClock()
    const f = createPoliteFetcher({ budget: 10 }, { fetchImpl: okFetch(), now: clock.now, sleep: clock.sleep, random: () => 0 })
    for (let i = 0; i < 4; i++) await f.get(URL_A)
    const at = f.log().map((l) => l.at)
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(MIN_DELAY_MS)
  })

  it('never goes below the minimum delay even if asked to', async () => {
    const clock = fakeClock()
    const f = createPoliteFetcher({ budget: 3, delayMs: 10 }, { fetchImpl: okFetch(), now: clock.now, sleep: clock.sleep, random: () => 0 })
    await f.get(URL_A)
    await f.get(URL_A)
    expect(clock.sleeps[0]).toBe(MIN_DELAY_MS)
  })

  it('stops at the per-run budget', async () => {
    const clock = fakeClock()
    const f = createPoliteFetcher({ budget: 2 }, { fetchImpl: okFetch(), now: clock.now, sleep: clock.sleep })
    await f.get(URL_A)
    await f.get(URL_A)
    await expect(f.get(URL_A)).rejects.toBeInstanceOf(BudgetExhausted)
    expect(f.requestsMade()).toBe(2)
  })

  it('serializes overlapping calls', async () => {
    const clock = fakeClock()
    const f = createPoliteFetcher({ budget: 5 }, { fetchImpl: okFetch(), now: clock.now, sleep: clock.sleep, random: () => 0 })
    await Promise.all([f.get(URL_A), f.get(URL_A), f.get(URL_A)])
    const at = f.log().map((l) => l.at)
    expect(at[2] - at[0]).toBeGreaterThanOrEqual(2 * MIN_DELAY_MS)
  })

  it('throws RateLimited on 429 with Retry-After', async () => {
    const clock = fakeClock()
    const f = createPoliteFetcher({ budget: 5 }, { fetchImpl: okFetch(429, { 'retry-after': '30' }), now: clock.now, sleep: clock.sleep })
    const err = await f.get(URL_A).catch((e) => e)
    expect(err).toBeInstanceOf(RateLimited)
    expect((err as RateLimited).retryAfterMs).toBe(30_000)
  })

  it('refuses URLs off the allowlist without making a request', async () => {
    const f = createPoliteFetcher({ budget: 5 }, { fetchImpl: okFetch() })
    await expect(f.get('https://example.com/')).rejects.toThrow('Blocked URL')
    expect(f.requestsMade()).toBe(0)
  })
})

describe('nextDelay', () => {
  it('doubles after a rate limit, caps at 60s, resets after a clean run', () => {
    expect(nextDelay(5_000, true)).toBe(10_000)
    expect(nextDelay(40_000, true)).toBe(MAX_DELAY_MS)
    expect(nextDelay(5_000, true, 45_000)).toBe(45_000)
    expect(nextDelay(40_000, false)).toBe(MIN_DELAY_MS)
  })
})

describe('robots', () => {
  const txt = `User-agent: AhrefsBot\nDisallow: /_next/*\nUser-agent: *\nDisallow: /design/*\nDisallow: /*/itemquote\nDisallow: /design/$\nCrawl-delay: 8\nAllow: /`

  it('reads only the * group', () => {
    const r = parseRobots(txt)
    expect(r.disallow).toEqual(['/design/*', '/*/itemquote', '/design/$'])
    expect(r.crawlDelayMs).toBe(8_000)
  })

  it('matches wildcard and anchored rules', () => {
    const { disallow } = parseRobots(txt)
    expect(isDisallowed('/design/foo', disallow)).toBe(true)
    expect(isDisallowed('/catalog/x/itemquote', disallow)).toBe(true)
    expect(isDisallowed('/catalog/richardson/adjustable-snapback-trucker-cap/', disallow)).toBe(false)
    expect(isDisallowed('/brands/richardson/hats/', disallow)).toBe(false)
  })
})
