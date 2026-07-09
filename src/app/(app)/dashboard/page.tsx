'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useAppUser } from '@/components/layout/AppShell'
import { NewsFeed } from '@/components/news/NewsFeed'
import { DashboardTasksWidget } from '@/components/dashboard/DashboardTasksWidget'
import { BannerSlide, BannerStripItem } from '@/types'

const DashboardCalendar = dynamic(() => import('@/components/dashboard/DashboardCalendar'), {
  ssr: false,
  loading: () => (
    <div className="card events-card">
      <div className="card-header">
        <div className="card-title">Company Calendar</div>
      </div>
      <div className="calendar-skeleton">
        <div className="calendar-skeleton-row" style={{ width: '42%' }} />
        <div className="calendar-skeleton-row" style={{ width: '100%', height: 220 }} />
      </div>
    </div>
  ),
})


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
  const [slides, setSlides] = useState<BannerSlide[]>(FALLBACK_SLIDES)
  const [current, setCurrent] = useState(0)
  const [isCarouselPaused, setIsCarouselPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [bannerItems, setBannerItems] = useState<BannerStripItem[]>([])

  useEffect(() => {
    fetch('/api/banner-strip')
      .then((r) => r.json())
      .then((data: { items: BannerStripItem[] }) => setBannerItems(data.items ?? []))
      .catch(() => {})
  }, [])


  useEffect(() => {
    fetch('/api/banner')
      .then((r) => r.json())
      .then((data: { slides: BannerSlide[] }) => {
        const live = data.slides ?? []
        setSlides(live.length > 0 ? live : FALLBACK_SLIDES)
      })
      .catch(() => setSlides(FALLBACK_SLIDES))
  }, [])

  // Auto-advance carousel
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    if (isCarouselPaused) return
    if (slides.length <= 1) return
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length)
    }, 4800)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isCarouselPaused, slides.length])

  function goTo(i: number) {
    if (slides.length === 0) return
    const next = ((i % slides.length) + slides.length) % slides.length
    setCurrent(next)
  }

  return (
    <>
      <style>{`
        /* ── Hero Carousel ── */
        .hero { position: relative; height: 540px; overflow: hidden; flex-shrink: 0; background: #16051f; }
        .hero-slides { display: flex; height: 100%; transition: transform 0.55s cubic-bezier(0.22,1,0.36,1); }
        .hero-slide { min-width: 100%; height: 100%; position: relative; display: flex; align-items: flex-end; overflow: hidden; background-size: cover; background-position: center; }
        .hs-1 { background: linear-gradient(135deg, #1a0a2e 0%, #4a1575 40%, #7c3aed 70%, #a855f7 100%); }
        .hs-2 { background: linear-gradient(135deg, #0c2340 0%, #1e4d8c 40%, #2563eb 70%, #60a5fa 100%); }
        .hs-3 { background: linear-gradient(135deg, #1a2e0c 0%, #2e5c1a 40%, #16a34a 70%, #4ade80 100%); }
        .hs-4 { background: linear-gradient(135deg, #2e1a0c 0%, #7c3404 40%, #c2410c 70%, #fb923c 100%); }
        .hs-5 { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #533483 100%); }
        .hero-slide::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 60% at 75% 40%, rgba(255,255,255,0.08) 0%, transparent 70%), radial-gradient(ellipse 40% 50% at 20% 60%, rgba(255,255,255,0.05) 0%, transparent 60%); }
        .hero-slide::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 50%, transparent 100%); }
        .hero-caption { position: relative; z-index: 10; padding: 0 28px 22px; width: 100%; max-width: 780px; }
        .hero-eyebrow { font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.74); margin-bottom: 5px; }
        .hero-title { font-size: 22px; font-weight: 800; color: #fff; line-height: 1.2; margin-bottom: 4px; text-shadow: 0 1px 4px rgba(0,0,0,0.4); text-wrap: balance; }
        .hero-sub { font-size: 13px; color: rgba(255,255,255,0.84); font-weight: 500; max-width: 68ch; text-wrap: pretty; }
        .hero-learn-more { display: inline-block; margin-top: 10px; padding: 6px 14px; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.4); border-radius: 999px; font-size: 12px; font-weight: 700; color: #fff; text-decoration: none; backdrop-filter: blur(4px); transition: background 150ms ease, border-color 150ms ease; }
        .hero-learn-more:hover { background: rgba(255,255,255,0.28); border-color: rgba(255,255,255,0.6); }
        .hero-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 20; width: 36px; height: 36px; background: rgba(0,0,0,0.38); border: 1px solid rgba(255,255,255,0.32); border-radius: 999px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; transition: background 150ms ease, border-color 150ms ease; }
        .hero-arrow:hover { background: rgba(107,30,152,0.82); border-color: rgba(255,255,255,0.46); }
        .hero-arrow:focus-visible, .hero-dot:focus-visible, .banner-edit:focus-visible, .card-action:focus-visible { outline: 2px solid #c084fc; outline-offset: 2px; }
        .hero-prev { left: 14px; }
        .hero-next { right: 14px; }
        .hero-dots { position: absolute; bottom: 14px; right: 24px; display: flex; gap: 6px; z-index: 20; }
        .hero-dot { width: 8px; height: 8px; border: 0; padding: 0; border-radius: 999px; background: rgba(255,255,255,0.42); cursor: pointer; transition: 150ms background ease, 150ms transform ease; }
        .hero-dot:hover { background: rgba(255,255,255,0.72); }
        .hero-dot.active { background: #fff; width: 18px; }

        /* ── Banner Strip ── */
        .banner-strip { background: linear-gradient(90deg, #6b1e98, #7c3aed, #9333ea, #6b1e98); background-size: 300% 100%; animation: gradientShift 8s ease infinite; height: 36px; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; position: relative; }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .banner-strip:hover .banner-inner, .banner-strip:focus-within .banner-inner { animation-play-state: paused; }
        .banner-inner { display: flex; align-items: center; white-space: nowrap; animation: marquee 28s linear infinite; }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
        .banner-item { display: inline-flex; align-items: center; gap: 8px; padding: 0 28px; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.92); letter-spacing: 0.01em; }
        .banner-dot-sep { color: rgba(255,255,255,0.35); font-size: 16px; }
        .banner-label { font-size: 9px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; background: rgba(255,255,255,0.2); color: #fff; padding: 2px 7px; border-radius: 3px; margin-right: 4px; }
        .banner-edit { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); z-index: 10; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; padding: 3px 9px; font-size: 10px; font-weight: 700; color: #fff; cursor: pointer; letter-spacing: 0.04em; text-decoration: none; }
        .banner-edit:hover { background: rgba(255,255,255,0.25); }

        /* ── Cards ── */
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
        .card-header { padding: 13px 16px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; }
        .card-title { font-size: 13px; font-weight: 700; color: #111; }
        .card-action { font-size: 12px; color: #6b1e98; cursor: pointer; font-weight: 600; border-radius: 4px; }
        .card-body { padding: 12px 16px; }

        /* ── Events Calendar ── */
        .events-card .card-body { padding: 0; }
        .events-tools { padding: 10px 14px; display: flex; flex-wrap: wrap; gap: 7px; border-bottom: 1px solid #f3f4f6; }
.calendar-shell { padding: 12px 14px 14px; }
        .calendar-empty, .calendar-error { font-size: 12px; color: #6b7280; padding: 20px 14px; text-align: center; }
        .calendar-error { color: #b91c1c; background: #fef2f2; border-top: 1px solid #fee2e2; }
        .calendar-skeleton { padding: 14px; }
        .calendar-skeleton-row { height: 18px; background: #f5f5f5; border-radius: 5px; margin-bottom: 9px; }
        .arc-calendar .fc { --fc-border-color: #f1f5f9; --fc-today-bg-color: #faf5ff; --fc-page-bg-color: #fff; font-family: inherit; }
        .arc-calendar .fc .fc-toolbar.fc-header-toolbar { margin-bottom: 10px; gap: 8px; align-items: center; }
        .arc-calendar .fc .fc-toolbar-title { font-size: 15px; font-weight: 800; color: #111; }
        .arc-calendar .fc .fc-button { background: #fff; border: 1px solid #e5e7eb; color: #555; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 700; text-transform: none; box-shadow: none; }
        .arc-calendar .fc .fc-button:hover, .arc-calendar .fc .fc-button-primary:not(:disabled).fc-button-active { background: #6b1e98; border-color: #6b1e98; color: #fff; }
        .arc-calendar .fc .fc-col-header-cell-cushion { color: #888; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; text-decoration: none; padding: 6px 0; }
        .arc-calendar .fc .fc-daygrid-day-number { color: #555; font-size: 11px; font-weight: 700; text-decoration: none; padding: 5px 6px 2px; }
        .arc-calendar .fc .fc-day-today .fc-daygrid-day-number { color: #6b1e98; }
        .arc-calendar .fc .fc-daygrid-day-frame { min-height: 70px; }
        .arc-calendar .fc .fc-event { border-radius: 5px; border: 0; padding: 1px 3px; cursor: pointer; }
        .arc-calendar .fc .fc-daygrid-event { margin: 1px 4px; }
        .arc-cal-event { display: flex; align-items: center; gap: 4px; min-width: 0; font-size: 10px; font-weight: 700; line-height: 1.4; }
        .arc-cal-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
        .arc-cal-time { opacity: 0.85; flex-shrink: 0; }
        .arc-cal-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .event-detail { border-top: 1px solid #f3f4f6; padding: 12px 14px; background: #fafafa; }
        .event-detail-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 5px; }
        .event-detail-title { font-size: 14px; font-weight: 800; color: #111; margin-bottom: 4px; }
        .event-detail-meta { font-size: 11px; color: #777; display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
        .event-type-pill { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 3px 8px; font-size: 10px; font-weight: 800; }
        .event-detail-desc { font-size: 12px; color: #555; margin-top: 8px; line-height: 1.45; white-space: pre-line; }

        /* ── Responsive layout ── */
        .dash-content { padding: 22px 28px 28px; }

        @media (max-width: 1023px) {
          .hero { height: 280px; }
          .dash-content { padding: 18px 20px 24px; }
        }

        @media (max-width: 639px) {
          .hero { height: 220px; }
          .hero-title { font-size: 18px; }
          .hero-sub { font-size: 12px; }
          .hero-caption { padding: 0 16px 14px; }
          .dash-content { padding: 14px 14px 20px; }
          .arc-calendar .fc .fc-toolbar.fc-header-toolbar { align-items: flex-start; flex-direction: column; }
          .arc-calendar .fc .fc-toolbar-chunk { display: flex; gap: 4px; max-width: 100%; flex-wrap: wrap; }
          .arc-calendar .fc .fc-daygrid-day-frame { min-height: 58px; }
          .arc-cal-time { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-slides, .hero-dot, .hero-arrow, .event-filter { transition: none; }
          .banner-strip, .banner-inner { animation: none; }
        }
      `}</style>

      {/* ── Hero Carousel ── */}
      <div
        className="hero"
        onMouseEnter={() => setIsCarouselPaused(true)}
        onMouseLeave={() => setIsCarouselPaused(false)}
        onFocus={() => setIsCarouselPaused(true)}
        onBlur={() => setIsCarouselPaused(false)}
      >
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
                {slide.link_url && (
                  <a
                    href={slide.link_url}
                    className="hero-learn-more"
                    target={slide.link_url.startsWith('http') ? '_blank' : undefined}
                    rel={slide.link_url.startsWith('http') ? 'noopener noreferrer' : undefined}
                  >
                    Learn More →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Prev arrow */}
        {slides.length > 1 && (
          <button
            type="button"
            className="hero-arrow hero-prev"
            onClick={() => goTo(current - 1)}
            aria-label="Show previous dashboard announcement"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {/* Next arrow */}
        {slides.length > 1 && (
          <button
            type="button"
            className="hero-arrow hero-next"
            onClick={() => goTo(current + 1)}
            aria-label="Show next dashboard announcement"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        {/* Dots */}
        {slides.length > 1 && (
          <div className="hero-dots" aria-label="Dashboard announcement slides">
            {slides.map((_, i) => (
              <button
                type="button"
                key={i}
                className={`hero-dot${i === current ? ' active' : ''}`}
                onClick={() => goTo(i)}
                aria-label={`Show dashboard announcement ${i + 1}`}
                aria-current={i === current ? 'true' : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Banner Strip ── */}
      {bannerItems.length > 0 && (
        <div className="banner-strip">
          <div className="banner-inner">
            {bannerItems.map((item, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <span className="banner-item">
                  {item.avatar_url && (item.source === 'birthday' || item.source === 'anniversary') && (
                    <img
                      src={item.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', marginRight: 6, flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.5)' }}
                    />
                  )}
                  <span className="banner-label">{item.label}</span>
                  {item.href ? (
                    <Link href={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {item.text}
                    </Link>
                  ) : item.text}
                </span>
                <span className="banner-dot-sep">·</span>
              </span>
            ))}
          </div>
          {user?.is_admin && (
            <Link href="/admin/banner-strip" className="banner-edit">
              ✏ Edit Strip
            </Link>
          )}
        </div>
      )}

      {/* ── Below-fold content ── */}
      <div className="dash-content">
          {/* News & Announcements */}
          <div style={{ marginBottom: 24 }}>
              <NewsFeed />
          </div>

          {/* My Tasks */}
          <DashboardTasksWidget />


        {/* Company Calendar — full width */}
        <DashboardCalendar />

      </div>
    </>
  )
}
