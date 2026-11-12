import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeGeometry, mergeGeometry } from '@/lib/hat-mockup/geometry'
import { ensureBlankImage, geometryLightness, type HatColorRow, type HatStyleRow } from '@/lib/hat-mockup/service'
import {
  BRAND_LISTINGS,
  inCrawlWindow,
  MAX_ERRORS_PER_RUN,
  MIN_DELAY_MS,
  RECHECK_AFTER_DAYS,
  REQUESTS_PER_RUN,
  SITE_ORIGIN,
  STALE_LOCK_MINUTES,
  VENDOR,
} from './config'
import { BudgetExhausted, createPoliteFetcher, isDisallowed, nextDelay, parseRobots, RateLimited, type PoliteFetcher } from './fetcher'
import { parseListing, parseProduct, type ParsedProduct } from './parse'

type Db = ReturnType<typeof createAdminClient>

type Cursor = {
  phase: 'robots' | 'listings' | 'products' | 'deactivate' | 'geometry' | 'done'
  listing: number // index into flattened BRAND_LISTINGS urls
  queue: { path: string; brand: string }[]
  seen: string[]
  geometry: string[] // style ids still to measure
  robotsDelayMs: number | null
}

export type SyncOutcome = {
  status: 'ok' | 'paused' | 'failed' | 'busy' | 'idle' | 'outside_window'
  syncId?: string
  requests: number
  message: string
}

class SyncFailure extends Error {}

const LISTINGS = BRAND_LISTINGS.flatMap((b) => b.urls.map((url) => ({ url, brand: b.brand })))
const freshCursor = (): Cursor => ({ phase: 'robots', listing: 0, queue: [], seen: [], geometry: [], robotsDelayMs: null })
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()

async function releaseStaleLocks(db: Db) {
  const cutoff = new Date(Date.now() - STALE_LOCK_MINUTES * 60_000).toISOString()
  await db
    .from('hat_catalog_syncs')
    .update({ status: 'failed', finished_at: new Date().toISOString(), errors: [{ message: 'Run crashed or timed out (stale lock released)' }] })
    .eq('status', 'running')
    .lt('run_started_at', cutoff)
}

/** Claims a sync to work on: resume a paused one, or start a new one when one is due. */
async function claimSync(db: Db, trigger: 'cron' | 'manual') {
  const now = new Date().toISOString()
  const { data: paused } = await db
    .from('hat_catalog_syncs')
    .select('*')
    .eq('status', 'paused')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (paused) {
    const { data, error } = await db
      .from('hat_catalog_syncs')
      .update({ status: 'running', run_started_at: now })
      .eq('id', paused.id)
      .eq('status', 'paused')
      .select()
      .maybeSingle()
    if (error || !data) return { busy: true as const }
    return { sync: data }
  }

  const { data: last } = await db.from('hat_catalog_syncs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (trigger === 'cron' && last) {
    const { data: lastOk } = await db
      .from('hat_catalog_syncs')
      .select('started_at')
      .eq('status', 'ok')
      .gte('started_at', daysAgo(RECHECK_AFTER_DAYS - 1))
      .limit(1)
      .maybeSingle()
    // Weekly refresh; after a failure wait about a day before trying again.
    if (lastOk || last.started_at > daysAgo(0.8)) return { idle: true as const }
  }

  const { data, error } = await db
    .from('hat_catalog_syncs')
    .insert({ status: 'running', trigger, run_started_at: now, cursor: freshCursor(), next_delay_ms: last?.next_delay_ms ?? MIN_DELAY_MS })
    .select()
    .single()
  if (error || !data) return { busy: true as const } // unique index: another sync is running
  return { sync: data }
}

async function saveProduct(db: Db, p: ParsedProduct, brand: string, headers: Headers): Promise<{ styleId: string; colors: number; needsGeometry: boolean }> {
  const nowIso = new Date().toISOString()
  const { data: style, error } = await db
    .from('hat_styles')
    .upsert(
      {
        vendor: VENDOR,
        brand,
        style_number: p.styleNumber,
        name: p.name,
        slug: p.path,
        url: p.url,
        categories: p.categories,
        sizes: p.sizes,
        silhouette: p.silhouette,
        profile: p.profile,
        details: p.details,
        price_breaks: p.priceBreaks,
        default_color_code: p.defaultColorCode,
        is_active: true,
        last_crawled_at: nowIso,
        last_checked_at: nowIso,
        etag: headers.get('etag'),
        last_modified: headers.get('last-modified'),
        updated_at: nowIso,
      },
      { onConflict: 'vendor,slug' },
    )
    .select('id')
    .single()
  if (error || !style) throw new Error(`Saving ${p.path}: ${error?.message}`)

  const { error: cErr } = await db.from('hat_colors').upsert(
    p.colors.map((c) => ({ style_id: style.id, color_code: c.code, name: c.name, hex: c.hex, hex_secondary: c.hexSecondary, is_active: true })),
    { onConflict: 'style_id,color_code' },
  )
  if (cErr) throw new Error(`Saving colors for ${p.path}: ${cErr.message}`)
  const codes = new Set(p.colors.map((c) => c.code))
  const { data: existing } = await db.from('hat_colors').select('id, color_code').eq('style_id', style.id)
  const gone = (existing ?? []).filter((c) => !codes.has(c.color_code)).map((c) => c.id)
  if (gone.length) await db.from('hat_colors').update({ is_active: false }).in('id', gone)

  await db.from('hat_decoration_methods').delete().eq('style_id', style.id)
  if (p.methods.length) {
    await db
      .from('hat_decoration_methods')
      .insert(p.methods.map((m) => ({ style_id: style.id, method: m.method, minimum_quantity: m.minimumQuantity })))
  }

  const { data: geo } = await db.from('hat_style_geometry').select('style_id').eq('style_id', style.id).maybeSingle()
  return { styleId: style.id, colors: p.colors.length, needsGeometry: !geo }
}

async function measureStyle(db: Db, fetcher: PoliteFetcher, styleId: string) {
  const { data: existing } = await db.from('hat_style_geometry').select('is_override').eq('style_id', styleId).maybeSingle()
  if (existing?.is_override) return
  const { data: style } = await db.from('hat_styles').select('*').eq('id', styleId).single<HatStyleRow>()
  const { data: colors } = await db.from('hat_colors').select('*').eq('style_id', styleId).eq('is_active', true)
  if (!style || !colors?.length) return

  const [a, b] = [...(colors as HatColorRow[])].sort((x, y) => geometryLightness(x) - geometryLightness(y))
  const ga = await computeGeometry(await ensureBlankImage(db, style, a, fetcher), style.profile)
  const gb = b ? await computeGeometry(await ensureBlankImage(db, style, b, fetcher), style.profile) : null
  const { needs_review, ...g } = mergeGeometry(ga, gb)
  await db.from('hat_style_geometry').upsert({
    style_id: styleId,
    view: 'fr',
    source_color_code: a.color_code,
    ...g,
    needs_review: needs_review || geometryLightness(a) > 0.5,
    is_override: false,
    computed_at: new Date().toISOString(),
  })
}

/**
 * Runs one budgeted batch of the catalog sync (at most REQUESTS_PER_RUN
 * vendor requests, paced) and saves where it stopped so the next run resumes.
 */
export async function runSyncBatch(trigger: 'cron' | 'manual'): Promise<SyncOutcome> {
  const db = createAdminClient()
  await releaseStaleLocks(db)
  if (trigger === 'cron' && !inCrawlWindow()) return { status: 'outside_window', requests: 0, message: 'Outside the nightly crawl window' }

  const claim = await claimSync(db, trigger)
  if ('busy' in claim) return { status: 'busy', requests: 0, message: 'Another sync is running' }
  if ('idle' in claim) return { status: 'idle', requests: 0, message: 'Catalog is up to date' }
  const sync = claim.sync

  const cursor: Cursor = { ...freshCursor(), ...(sync.cursor ?? {}) }
  const delay = Math.max(sync.next_delay_ms ?? MIN_DELAY_MS, cursor.robotsDelayMs ?? 0)
  const fetcher = createPoliteFetcher({ delayMs: delay, budget: REQUESTS_PER_RUN })
  const errors: { message: string; url?: string; at: string }[] = [...(sync.errors ?? [])]
  let runErrors = 0
  let stylesSeen = sync.styles_seen ?? 0
  let colorsSeen = sync.colors_seen ?? 0
  let rateLimited: RateLimited | null = null
  let status: 'ok' | 'paused' | 'failed' = 'paused'

  const recordError = (message: string, url?: string) => {
    errors.push({ message, url, at: new Date().toISOString() })
    if (++runErrors >= MAX_ERRORS_PER_RUN) throw new SyncFailure(`${runErrors} errors in one run`)
  }

  try {
    if (cursor.phase === 'robots') {
      const res = await fetcher.get(`${SITE_ORIGIN}/robots.txt`)
      if (res.status === 200) {
        const robots = parseRobots(await res.text())
        const used = ['/catalog/x/y/', ...LISTINGS.map((l) => new URL(l.url).pathname)]
        const blocked = used.filter((p) => isDisallowed(p, robots.disallow))
        if (blocked.length) throw new SyncFailure(`robots.txt now disallows paths we use: ${blocked.join(', ')}`)
        cursor.robotsDelayMs = robots.crawlDelayMs
      }
      cursor.phase = 'listings'
      if ((cursor.robotsDelayMs ?? 0) > delay) throw new BudgetExhausted() // restart next run at the slower pace
    }

    while (cursor.phase === 'listings') {
      const l = LISTINGS[cursor.listing]
      if (!l) {
        cursor.phase = 'products'
        break
      }
      const res = await fetcher.get(l.url)
      if (res.status !== 200) throw new SyncFailure(`Listing ${l.url} returned HTTP ${res.status}`)
      const brandSlug = new URL(l.url).pathname.split('/')[2]
      const items = parseListing(await res.text(), brandSlug)
      if (!items.length) throw new SyncFailure(`Listing ${l.url} had no products; the page layout may have changed`)
      const queued = new Set(cursor.queue.map((q) => q.path))
      for (const it of items) if (!queued.has(it.path)) cursor.queue.push({ path: it.path, brand: l.brand })
      cursor.listing++
    }

    while (cursor.phase === 'products') {
      const next = cursor.queue.find((q) => !cursor.seen.includes(q.path))
      if (!next) {
        cursor.phase = 'deactivate'
        break
      }
      const { data: existing } = await db
        .from('hat_styles')
        .select('id, last_checked_at, etag, last_modified')
        .eq('vendor', VENDOR)
        .eq('slug', next.path)
        .maybeSingle()

      if (existing?.last_checked_at && existing.last_checked_at > daysAgo(RECHECK_AFTER_DAYS)) {
        cursor.seen.push(next.path) // checked this week; no request
        continue
      }
      const url = SITE_ORIGIN + next.path
      const res = await fetcher.get(url, { etag: existing?.etag, lastModified: existing?.last_modified })
      if (res.status === 304 && existing) {
        await db.from('hat_styles').update({ last_checked_at: new Date().toISOString(), is_active: true }).eq('id', existing.id)
      } else if (res.status === 200) {
        const parsed = parseProduct(await res.text(), next.path)
        if (!parsed) throw new SyncFailure(`Could not read product data on ${url}; the page layout may have changed`)
        const saved = await saveProduct(db, parsed, next.brand, res.headers)
        stylesSeen++
        colorsSeen += saved.colors
        if (saved.needsGeometry && !cursor.geometry.includes(saved.styleId)) cursor.geometry.push(saved.styleId)
      } else {
        recordError(`HTTP ${res.status}`, url)
      }
      cursor.seen.push(next.path)
    }

    if (cursor.phase === 'deactivate') {
      const seen = new Set(cursor.seen)
      for (const brand of new Set(LISTINGS.map((l) => l.brand))) {
        const { data: rows } = await db.from('hat_styles').select('id, slug').eq('vendor', VENDOR).eq('brand', brand).eq('is_active', true)
        const gone = (rows ?? []).filter((r) => !seen.has(r.slug)).map((r) => r.id)
        if (gone.length) await db.from('hat_styles').update({ is_active: false }).in('id', gone)
      }
      const { data: unmeasured } = await db.from('hat_styles').select('id, hat_style_geometry(style_id)').eq('vendor', VENDOR).eq('is_active', true)
      for (const s of unmeasured ?? []) {
        const g = (s as { hat_style_geometry: unknown[] | null }).hat_style_geometry
        if ((!g || g.length === 0) && !cursor.geometry.includes(s.id)) cursor.geometry.push(s.id)
      }
      cursor.phase = 'geometry'
    }

    while (cursor.phase === 'geometry') {
      const styleId = cursor.geometry[0]
      if (!styleId) {
        cursor.phase = 'done'
        break
      }
      try {
        await measureStyle(db, fetcher, styleId)
      } catch (err) {
        if (err instanceof BudgetExhausted || err instanceof RateLimited) throw err
        recordError(`Geometry for style ${styleId}: ${(err as Error).message}`)
      }
      cursor.geometry.shift()
    }

    status = 'ok'
  } catch (err) {
    if (err instanceof BudgetExhausted) status = 'paused'
    else if (err instanceof RateLimited) {
      rateLimited = err
      status = 'paused'
      errors.push({ message: err.message, at: new Date().toISOString() })
    } else {
      status = 'failed'
      errors.push({ message: (err as Error).message, at: new Date().toISOString() })
      if (!(err instanceof SyncFailure)) Sentry.captureException(err)
    }
  }

  const requests = fetcher.requestsMade()
  await db
    .from('hat_catalog_syncs')
    .update({
      status,
      cursor,
      errors: errors.slice(-50),
      styles_seen: stylesSeen,
      colors_seen: colorsSeen,
      requests_made: (sync.requests_made ?? 0) + requests,
      next_delay_ms: nextDelay(sync.next_delay_ms ?? MIN_DELAY_MS, !!rateLimited, rateLimited?.retryAfterMs),
      finished_at: status === 'paused' ? null : new Date().toISOString(),
    })
    .eq('id', sync.id)

  const message =
    status === 'ok'
      ? `Sync finished: ${stylesSeen} styles updated`
      : status === 'paused'
        ? rateLimited
          ? 'Vendor asked us to slow down; will resume next run at a slower pace'
          : `Paused after ${requests} requests; resumes next run`
        : errors.at(-1)?.message ?? 'Sync failed'
  return { status, syncId: sync.id, requests, message }
}
