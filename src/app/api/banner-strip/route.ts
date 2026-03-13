import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  todayMidnight,
  getBirthdayItems,
  getAnniversaryItems,
  getHolidayItems,
  getClickUpItems,
  getActiveManualItems,
  articleTypeLabel,
} from '@/lib/ticker-sources'
import { BannerStripItem, TickerConfig } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Auth check — must be a logged-in user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const today = todayMidnight()

  // ── 1. Load ticker config ──────────────────────────────────────────────────
  const { data: configRow, error: configErr } = await adminClient
    .from('ticker_config')
    .select('*')
    .single()

  if (configErr || !configRow) {
    // Config table not set up yet — return empty
    return NextResponse.json({ items: [] })
  }

  const config = configRow as TickerConfig
  const items: BannerStripItem[] = []

  // ── 2. Manual items (highest priority) ────────────────────────────────────
  items.push(...getActiveManualItems(config.manual_items ?? [], today))

  // ── 3. Birthdays & anniversaries ──────────────────────────────────────────
  if (config.show_birthdays || config.show_anniversaries) {
    const { data: users } = await adminClient
      .from('users')
      .select('id, display_name, birth_date, start_date')
      .or('birth_date.not.is.null,start_date.not.is.null')

    const userRows = users ?? []

    if (config.show_birthdays) {
      items.push(...getBirthdayItems(userRows, today, config.birthday_window_days))
    }
    if (config.show_anniversaries) {
      items.push(...getAnniversaryItems(userRows, today, config.anniversary_window_days))
    }
  }

  // ── 4. Recent news articles ────────────────────────────────────────────────
  if (config.show_news) {
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() - config.news_recency_days)

    const { data: articles } = await adminClient
      .from('news_articles')
      .select('id, title, type, publish_date')
      .eq('status', 'published')
      .gte('publish_date', cutoff.toISOString())
      .order('pinned', { ascending: false })
      .order('publish_date', { ascending: false })
      .limit(5)

    for (const article of articles ?? []) {
      items.push({
        id: `news-${article.id}`,
        label: articleTypeLabel(article.type),
        text: article.title,
        href: `/news/${article.id}`,
        source: 'news',
      })
    }
  }

  // ── 5. US Holidays ─────────────────────────────────────────────────────────
  if (config.show_holidays) {
    items.push(...getHolidayItems(today, config.holiday_lookahead_days))
  }

  // ── 6. ClickUp tasks ───────────────────────────────────────────────────────
  if (config.show_clickup && config.clickup_api_key && config.clickup_list_id) {
    const clickupItems = await getClickUpItems(
      config.clickup_api_key,
      config.clickup_list_id,
      config.clickup_due_within_days,
      today,
    )
    items.push(...clickupItems)
  }

  return NextResponse.json({ items })
}
