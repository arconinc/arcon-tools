import { isAllowedUrl, JITTER_MS, MAX_DELAY_MS, MIN_DELAY_MS, REQUEST_TIMEOUT_MS, USER_AGENT } from './config'

export class BudgetExhausted extends Error {
  constructor() {
    super('Per-run request budget used up')
  }
}

export class RateLimited extends Error {
  constructor(public status: number, public retryAfterMs: number | null) {
    super(`Vendor asked us to slow down (HTTP ${status})`)
  }
}

export type PoliteResponse = {
  status: number
  headers: Headers
  text: () => Promise<string>
  buffer: () => Promise<Buffer>
}

type Deps = {
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  random?: () => number
}

export type PoliteFetcher = {
  get: (url: string, opts?: { etag?: string | null; lastModified?: string | null }) => Promise<PoliteResponse>
  requestsMade: () => number
  log: () => { url: string; at: number; status: number }[]
}

function parseRetryAfter(value: string | null, now: number): number | null {
  if (!value) return null
  const secs = Number(value)
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000)
  const date = Date.parse(value)
  return Number.isNaN(date) ? null : Math.max(0, date - now)
}

/**
 * One-request-at-a-time fetcher with a hard per-run budget and a minimum gap
 * (plus jitter) between requests. Every vendor request goes through this.
 */
export function createPoliteFetcher(
  { delayMs = MIN_DELAY_MS, budget }: { delayMs?: number; budget: number },
  deps: Deps = {},
): PoliteFetcher {
  const fetchImpl = deps.fetchImpl ?? fetch
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const now = deps.now ?? Date.now
  const random = deps.random ?? Math.random
  const gap = Math.min(Math.max(delayMs, MIN_DELAY_MS), MAX_DELAY_MS)

  let made = 0
  let lastAt: number | null = null
  let queue: Promise<unknown> = Promise.resolve()
  const history: { url: string; at: number; status: number }[] = []

  async function doGet(url: string, opts: { etag?: string | null; lastModified?: string | null } = {}) {
    if (!isAllowedUrl(url)) throw new Error(`Blocked URL: ${url}`)
    if (made >= budget) throw new BudgetExhausted()

    if (lastAt !== null) {
      const wait = lastAt + gap + Math.floor(random() * JITTER_MS) - now()
      if (wait > 0) await sleep(wait)
    }
    made++
    lastAt = now()

    const headers: Record<string, string> = { 'User-Agent': USER_AGENT }
    if (opts.etag) headers['If-None-Match'] = opts.etag
    if (opts.lastModified) headers['If-Modified-Since'] = opts.lastModified

    const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), redirect: 'follow' })
    history.push({ url, at: lastAt, status: res.status })
    if (res.url && !isAllowedUrl(res.url)) throw new Error(`Redirected off allowlist: ${res.url}`)
    if (res.status === 429 || res.status === 503) {
      throw new RateLimited(res.status, parseRetryAfter(res.headers.get('retry-after'), now()))
    }
    return {
      status: res.status,
      headers: res.headers,
      text: () => res.text(),
      buffer: async () => Buffer.from(await res.arrayBuffer()),
    }
  }

  return {
    // Serialize calls so two awaits can never overlap, even if a caller forgets to await.
    get: (url, opts) => {
      const p = queue.then(() => doGet(url, opts))
      queue = p.catch(() => undefined)
      return p
    },
    requestsMade: () => made,
    log: () => [...history],
  }
}

/** Next run's base delay: double after a rate limit (capped), reset after a clean run. */
export function nextDelay(current: number, rateLimited: boolean, retryAfterMs: number | null = null): number {
  if (!rateLimited) return MIN_DELAY_MS
  return Math.min(MAX_DELAY_MS, Math.max(current * 2, retryAfterMs ?? 0, MIN_DELAY_MS))
}

/** Robots rules for `User-agent: *`. Returns disallowed path prefixes and any crawl delay (ms). */
export function parseRobots(txt: string): { disallow: string[]; crawlDelayMs: number | null } {
  const disallow: string[] = []
  let crawlDelayMs: number | null = null
  let applies = false
  let lastWasAgent = false
  for (const rawLine of txt.split('\n')) {
    const line = rawLine.replace(/#.*/, '').trim()
    if (!line) continue
    const [k, ...rest] = line.split(':')
    const key = k.trim().toLowerCase()
    const value = rest.join(':').trim()
    if (key === 'user-agent') {
      applies = lastWasAgent ? applies || value === '*' : value === '*'
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!applies) continue
    if (key === 'disallow' && value) disallow.push(value)
    if (key === 'crawl-delay' && Number.isFinite(Number(value))) crawlDelayMs = Number(value) * 1000
  }
  return { disallow, crawlDelayMs }
}

/** True if `path` matches a robots Disallow rule (supports `*` and trailing `$`). */
export function isDisallowed(path: string, disallow: string[]): boolean {
  return disallow.some((rule) => {
    const anchored = rule.endsWith('$')
    const body = (anchored ? rule.slice(0, -1) : rule).split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')
    return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path)
  })
}
