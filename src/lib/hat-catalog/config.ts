// Vendor catalog crawl settings. These are constants on purpose: the crawl
// must stay slow and polite to RushOrderTees (our vendor), so nobody should be
// able to turn the limits up from an env var. See "Crawl Rate Limits" in
// docs/plans/hat-mockup-assistant-plan-v1.md.

export const VENDOR = 'rushordertees'
export const SITE_ORIGIN = 'https://www.rushordertees.com'
export const IMAGE_ORIGIN = 'https://img.rushordertees.com'

/** Hosts the crawler may fetch. No user-supplied URL ever reaches fetch. */
export const ALLOWED_HOSTS = new Set(['www.rushordertees.com', 'img.rushordertees.com'])

/** Paths we must never request (their designer + overlay renderer). */
export const FORBIDDEN_PATH_PREFIXES = ['/design/', '/design-v2/', '/designbeta/', '/designonline/', '/dol/']
export const FORBIDDEN_PATH_PARTS = ['ZoomImage.php']

// ponytail: Cap America's brand page (/brands/cap-america/hats/) returned 404 on
// 2026-10-27. Add its listing URLs here once we know where Arcon sources it.
export const BRAND_LISTINGS: { brand: string; urls: string[] }[] = [
  {
    brand: 'Richardson',
    urls: [
      `${SITE_ORIGIN}/brands/richardson/hats/`,
      `${SITE_ORIGIN}/brands/richardson/trucker-hats/`,
    ],
  },
]

// TODO(hat-mockups): add a real IT contact email so the vendor can reach us.
export const USER_AGENT = 'ArconTheArcCatalogSync/1.0 (+https://thearc.arconinc.com)'

export const MIN_DELAY_MS = 5_000
export const JITTER_MS = 2_000
export const MAX_DELAY_MS = 60_000
export const REQUESTS_PER_RUN = 40
export const REQUEST_TIMEOUT_MS = 15_000
export const MAX_ERRORS_PER_RUN = 3
export const RECHECK_AFTER_DAYS = 7
export const STALE_LOCK_MINUTES = 15

/** Nightly crawl window, America/Chicago hours [start, end). */
export const CRAWL_WINDOW_CENTRAL = { startHour: 1, endHour: 5 }

export const BLANKS_BUCKET = 'hat-blanks'

export function blankImageUrl(style: string, colorCode: string, view: 'fr' | 'sd' | 'bk' = 'fr'): string {
  return `${IMAGE_ORIGIN}/modelImages/${style.toLowerCase()}_${colorCode}_${view}.jpg`
}

export function blankImagePath(style: string, colorCode: string, view: 'fr' | 'sd' | 'bk' = 'fr'): string {
  return `${style.toLowerCase()}/${colorCode}_${view}.jpg`
}

export function isAllowedUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.host)) return false
  if (FORBIDDEN_PATH_PREFIXES.some((p) => u.pathname.startsWith(p))) return false
  if (FORBIDDEN_PATH_PARTS.some((p) => u.pathname.includes(p))) return false
  return true
}

export function inCrawlWindow(now = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hourCycle: 'h23' }).format(now),
  )
  return hour >= CRAWL_WINDOW_CENTRAL.startHour && hour < CRAWL_WINDOW_CENTRAL.endHour
}
