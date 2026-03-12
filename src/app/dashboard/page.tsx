'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAppUser } from '@/components/layout/AppShell'
import { NewsFeed } from '@/components/news/NewsFeed'
import { BannerSlide, BirthdayEvent } from '@/types'

const MOCK_TASKS = [
  { priority: 'high', name: 'Update CSR tracking doc', meta: 'Due Mar 13', pill: 'E-Commerce' },
  { priority: 'high', name: 'Review new store API creds', meta: 'Due Mar 14', pill: 'Admin' },
  { priority: 'med', name: 'Send Q1 vendor pricing', meta: 'Due Mar 17', pill: 'Sales' },
  { priority: 'low', name: 'Update employee handbook link', meta: 'Due Mar 21', pill: 'HR' },
]


const QUICK_LINKS = [
  { icon: '📦', bg: '#f3e8ff', label: 'Add Tracking', href: '/tasks/add-tracking' },
  { icon: '✅', bg: '#f3e8ff', label: 'My Tasks', href: '#' },
  { icon: '📁', bg: '#f5f5f5', label: 'HR Docs', href: '#' },
  { icon: '🏢', bg: '#f5f5f5', label: 'Vendors', href: '#' },
  { icon: '📝', bg: '#fff7ed', label: 'PTO Request', href: '#' },
  { icon: '➕', bg: '#f3e8ff', label: 'Add Customer', href: '#' },
]

const BANNER_ITEMS = [
  { label: 'Announce', text: 'Q1 All-Hands is March 20th — Zoom link coming soon' },
  { label: 'Birthday', text: '🎂 Happy Birthday Brooke Bowlin!' },
  { label: 'HR', text: 'Updated PTO Policy effective April 1 — see HR Docs' },
  { label: 'Sales', text: '2026 Pricing Sheet is live in Sales Documents' },
  { label: 'Anniversary', text: '🥂 Congrats Cami Johnson — 5 years at Arcon!' },
  { label: 'Reminder', text: 'Set The Arc as your browser homepage' },
]

// Fallback slides shown when the DB has no published slides yet
const FALLBACK_SLIDES: BannerSlide[] = [
  { id: 'f1', pre_heading: 'Our People', headline: 'The Dream Team', emoji: '🤝', subhead: 'Arcon Solutions · Eagan, MN', bg_type: 'gradient', bg_gradient: 'hs-1', bg_image_url: null },
  { id: 'f2', pre_heading: 'Upcoming', headline: 'Q1 All-Hands — March 20th', emoji: '📅', subhead: 'Zoom link and agenda coming by end of week', bg_type: 'gradient', bg_gradient: 'hs-2', bg_image_url: null },
  { id: 'f3', pre_heading: 'Company Win', headline: 'Record Orders in February', emoji: '📈', subhead: '23 orders processed yesterday — keep the momentum going!', bg_type: 'gradient', bg_gradient: 'hs-3', bg_image_url: null },
  { id: 'f4', pre_heading: '🎂 Birthday Today', headline: 'Happy Birthday, Brooke Bowlin!', emoji: '🎉', subhead: 'Wishing you a great day from the whole Arcon team', bg_type: 'gradient', bg_gradient: 'hs-4', bg_image_url: null },
  { id: 'f5', pre_heading: '5-Year Anniversary', headline: 'Congrats Cami Johnson — 5 Years!', emoji: '🥂', subhead: 'Thank you for five incredible years with Arcon', bg_type: 'gradient', bg_gradient: 'hs-5', bg_image_url: null },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAppUser()
  const [slides, setSlides] = useState<BannerSlide[]>([])
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [bdayEvents, setBdayEvents] = useState<(BirthdayEvent & { color: string })[]>([])
  const [bdayCount, setBdayCount] = useState(0)

  useEffect(() => {
    fetch('/api/admin/banner')
      .then((r) => r.json())
      .then((data: Array<{ status: string; slides_json: BannerSlide[] }>) => {
        if (Array.isArray(data)) {
          const pub = data.find((c) => c.status === 'published')
          const live = pub?.slides_json ?? []
          setSlides(live.length > 0 ? live : FALLBACK_SLIDES)
        } else {
          setSlides(FALLBACK_SLIDES)
        }
      })
      .catch(() => setSlides(FALLBACK_SLIDES))
  }, [])

  // Auto-advance carousel
  useEffect(() => {
    if (slides.length <= 1) return
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length)
    }, 4800)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [slides.length])

  useEffect(() => {
    fetch('/api/dashboard/birthdays')
      .then((r) => r.json())
      .then((d) => {
        if (d.events) {
          setBdayEvents(d.events)
          setBdayCount(d.birthdays_this_week ?? 0)
        }
      })
      .catch(() => {})
  }, [])

  function goTo(i: number) {
    const next = ((i % slides.length) + slides.length) % slides.length
    setCurrent(next)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 4800)
  }

  return (
    <>
      <style>{`
        /* ── Hero Carousel ── */
        .hero { position: relative; height: 480px; overflow: hidden; flex-shrink: 0; }
        .hero-slides { display: flex; height: 100%; transition: transform 0.7s cubic-bezier(0.77,0,0.18,1); }
        .hero-slide { min-width: 100%; height: 100%; position: relative; display: flex; align-items: flex-end; overflow: hidden; background-size: cover; background-position: center; }
        .hs-1 { background: linear-gradient(135deg, #1a0a2e 0%, #4a1575 40%, #7c3aed 70%, #a855f7 100%); }
        .hs-2 { background: linear-gradient(135deg, #0c2340 0%, #1e4d8c 40%, #2563eb 70%, #60a5fa 100%); }
        .hs-3 { background: linear-gradient(135deg, #1a2e0c 0%, #2e5c1a 40%, #16a34a 70%, #4ade80 100%); }
        .hs-4 { background: linear-gradient(135deg, #2e1a0c 0%, #7c3404 40%, #c2410c 70%, #fb923c 100%); }
        .hs-5 { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #533483 100%); }
        .hero-slide::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 60% at 75% 40%, rgba(255,255,255,0.08) 0%, transparent 70%), radial-gradient(ellipse 40% 50% at 20% 60%, rgba(255,255,255,0.05) 0%, transparent 60%); }
        .hero-slide::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 50%, transparent 100%); }
        .hero-caption { position: relative; z-index: 10; padding: 0 28px 22px; width: 100%; }
        .hero-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.6); margin-bottom: 4px; }
        .hero-title { font-size: 22px; font-weight: 800; color: #fff; line-height: 1.2; margin-bottom: 4px; text-shadow: 0 1px 4px rgba(0,0,0,0.4); }
        .hero-sub { font-size: 13px; color: rgba(255,255,255,0.75); font-weight: 500; }
        .hero-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 20; width: 36px; height: 36px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; backdrop-filter: blur(4px); }
        .hero-arrow:hover { background: rgba(107,30,152,0.7); }
        .hero-prev { left: 14px; }
        .hero-next { right: 14px; }
        .hero-dots { position: absolute; bottom: 14px; right: 24px; display: flex; gap: 6px; z-index: 20; }
        .hero-dot { width: 6px; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.35); cursor: pointer; transition: 0.2s background, 0.3s width; }
        .hero-dot.active { background: #fff; width: 18px; }

        /* ── Banner Strip ── */
        .banner-strip { background: linear-gradient(90deg, #6b1e98, #7c3aed, #9333ea, #6b1e98); background-size: 300% 100%; animation: gradientShift 8s ease infinite; height: 36px; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; position: relative; }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .banner-inner { display: flex; align-items: center; white-space: nowrap; animation: marquee 28s linear infinite; }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .banner-item { display: inline-flex; align-items: center; gap: 8px; padding: 0 28px; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.92); letter-spacing: 0.01em; }
        .banner-dot-sep { color: rgba(255,255,255,0.35); font-size: 16px; }
        .banner-label { font-size: 9px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; background: rgba(255,255,255,0.2); color: #fff; padding: 2px 7px; border-radius: 3px; margin-right: 4px; }
        .banner-edit { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); z-index: 10; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; padding: 3px 9px; font-size: 10px; font-weight: 700; color: #fff; cursor: pointer; letter-spacing: 0.04em; text-decoration: none; }
        .banner-edit:hover { background: rgba(255,255,255,0.25); }

        /* ── Widgets ── */
        .widget { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; }
        .widget-label { font-size: 11px; color: #999; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .widget-value { font-size: 26px; font-weight: 800; color: #111; }
        .widget-sub { font-size: 11px; color: #aaa; margin-top: 3px; }
        .widget-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .wi-purple { background: #f3e8ff; color: #6b1e98; }
        .wi-green  { background: #f0fdf4; color: #15803d; }
        .wi-orange { background: #fff7ed; color: #c2410c; }
        .wi-gray   { background: #f5f5f5; color: #555; }

        /* ── Cards ── */
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
        .card-header { padding: 13px 16px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; }
        .card-title { font-size: 13px; font-weight: 700; color: #111; }
        .card-action { font-size: 12px; color: #6b1e98; cursor: pointer; font-weight: 600; }
        .card-body { padding: 12px 16px; }

/* ── Tasks ── */
        .task-item { display: flex; align-items: flex-start; gap: 9px; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
        .task-item:last-child { border-bottom: none; }
        .task-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
        .dot-high { background: #dc2626; }
        .dot-med  { background: #f59e0b; }
        .dot-low  { background: #22c55e; }
        .task-name { font-size: 13px; color: #111; font-weight: 500; }
        .task-meta { font-size: 11px; color: #aaa; margin-top: 1px; }
        .task-pill { font-size: 10px; background: #f3e8ff; color: #6b1e98; border-radius: 3px; padding: 1px 6px; white-space: nowrap; font-weight: 600; }

        /* ── Birthdays ── */
        .bday-item { display: flex; align-items: center; gap: 9px; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
        .bday-item:last-child { border-bottom: none; }
        .bday-av { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0; }
        .bday-name { font-size: 13px; font-weight: 600; color: #111; }
        .bday-when { font-size: 11px; color: #aaa; }
        .bday-badge { font-size: 10px; padding: 2px 7px; border-radius: 3px; font-weight: 700; white-space: nowrap; }
        .badge-today { background: #f3e8ff; color: #6b1e98; }
        .badge-soon  { background: #f0fdf4; color: #15803d; }
        .badge-ann   { background: #fff7ed; color: #c2410c; }

        /* ── Quick Links ── */
        .quick-link { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 8px 12px; text-align: center; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; text-decoration: none; display: block; }
        .quick-link:hover { border-color: #6b1e98; box-shadow: 0 0 0 3px #f3e8ff; }
        .ql-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin: 0 auto 7px; font-size: 17px; }
        .ql-label { font-size: 11px; font-weight: 600; color: #555; }
      `}</style>

      {/* ── Hero Carousel ── */}
      <div className="hero">
        <div
          className="hero-slides"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {slides.map((slide) => (
            <div
              key={slide.id}
              className={`hero-slide${slide.bg_type === 'gradient' ? ` ${slide.bg_gradient}` : ''}`}
              style={slide.bg_type === 'image' && slide.bg_image_url
                ? { backgroundImage: `url(${slide.bg_image_url})` }
                : undefined}
            >
              <div className="hero-caption">
                {slide.pre_heading && <div className="hero-eyebrow">{slide.pre_heading}</div>}
                <div className="hero-title">
                  {slide.headline}
                  {slide.emoji ? ` ${slide.emoji}` : ''}
                </div>
                {slide.subhead && <div className="hero-sub">{slide.subhead}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Prev arrow */}
        {slides.length > 1 && (
          <div className="hero-arrow hero-prev" onClick={() => goTo(current - 1)}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        )}
        {/* Next arrow */}
        {slides.length > 1 && (
          <div className="hero-arrow hero-next" onClick={() => goTo(current + 1)}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
        {/* Dots */}
        {slides.length > 1 && (
          <div className="hero-dots">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`hero-dot${i === current ? ' active' : ''}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Banner Strip ── */}
      <div className="banner-strip">
        <div className="banner-inner">
          {/* Render twice for seamless loop */}
          {[...BANNER_ITEMS, ...BANNER_ITEMS].map((item, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <span className="banner-item">
                <span className="banner-label">{item.label}</span>
                {item.text}
              </span>
              <span className="banner-dot-sep">·</span>
            </span>
          ))}
        </div>
        {user?.is_admin && (
          <Link href="/admin/banner" className="banner-edit">
            ✏ Edit Banner
          </Link>
        )}
      </div>

      {/* ── Below-fold content ── */}
      <div style={{ padding: '22px 28px 28px' }}>
          {/* News & Announcements */}
          <div style={{ marginBottom: 24 }}>
              <NewsFeed />
          </div>


          {/* Stat widgets */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
          <div className="widget">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div className="widget-label">My Open Tasks</div>
                <div className="widget-value">4</div>
                <div className="widget-sub">2 due this week</div>
              </div>
              <div className="widget-icon wi-purple">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              </div>
            </div>
          </div>

          <div className="widget">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div className="widget-label">Team Tasks Open</div>
                <div className="widget-value">17</div>
                <div className="widget-sub">3 overdue</div>
              </div>
              <div className="widget-icon wi-orange">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
            </div>
          </div>

          <div className="widget">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div className="widget-label">Orders Today</div>
                <div className="widget-value">23</div>
                <div className="widget-sub">↑ 4 from yesterday</div>
              </div>
              <div className="widget-icon wi-green">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8 5-8-5m16 0v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7m16 0l-8-5-8 5" /></svg>
              </div>
            </div>
          </div>

          <div className="widget">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div className="widget-label">Birthdays This Week</div>
                <div className="widget-value">{bdayCount}</div>
                <div className="widget-sub">{bdayCount === 1 ? '1 birthday' : bdayCount === 0 ? 'None this week' : `${bdayCount} birthdays`}</div>
              </div>
              <div className="widget-icon wi-gray">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6l3-3 3 3M9 6h6M9 6a3 3 0 01-3 3m12-3a3 3 0 01-3 3" /></svg>
              </div>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Quick Links</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>Most used tools</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 24 }}>
          {QUICK_LINKS.map((ql) => (
            <Link key={ql.label} href={ql.href} className="quick-link">
              <div className="ql-icon" style={{ background: ql.bg }}>{ql.icon}</div>
              <div className="ql-label">{ql.label}</div>
            </Link>
          ))}
        </div>

        {/* Two-column section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* My Tasks */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">My Tasks</div>
              <div className="card-action">Open board →</div>
            </div>
            <div className="card-body">
              {MOCK_TASKS.map((task, i) => (
                <div key={i} className="task-item">
                  <div className={`task-dot dot-${task.priority}`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="task-name">{task.name}</div>
                    <div className="task-meta">{task.meta} · <span className="task-pill">{task.pill}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Birthdays & Anniversaries */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Birthdays &amp; Anniversaries</div>
              <div className="card-action">View all →</div>
            </div>
            <div className="card-body">
              {bdayEvents.length === 0 ? (
                <div style={{ fontSize: 12, color: '#bbb', padding: '8px 0' }}>Nothing in the next 14 days</div>
              ) : (
                bdayEvents.map((b) => {
                  const isBday = b.type === 'birthday'
                  const sub = isBday
                    ? `🎂 Birthday · ${b.date_label}`
                    : `🥂 ${b.years}yr Anniversary · ${b.date_label}`
                  const badge = b.days_until === 0 ? 'Today!' : b.days_until === 1 ? 'Tomorrow' : `${b.days_until} days`
                  const badgeClass = b.days_until === 0 ? 'badge-today' : isBday ? 'badge-soon' : 'badge-ann'
                  return (
                    <div key={b.id} className="bday-item">
                      <div className="bday-av" style={{ background: b.color }}>{b.initials}</div>
                      <div style={{ flex: 1 }}>
                        <div className="bday-name">{b.name}</div>
                        <div className="bday-when">{sub}</div>
                      </div>
                      <span className={`bday-badge ${badgeClass}`}>{badge}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
