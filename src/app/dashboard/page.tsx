'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import { EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core'
import { useAppUser } from '@/components/layout/AppShell'
import { NewsFeed } from '@/components/news/NewsFeed'
import {
  BannerSlide,
  BannerStripItem,
  CompanyCalendarEvent,
  CompanyCalendarEventType,
  CompanyCalendarEventTypeId,
  CompanyCalendarResponse,
  CrmForm,
} from '@/types'
import { US_STATES } from '@/lib/forms-utils'
import { countEventsThisWeek } from '@/lib/company-calendar-config'


const QUICK_LINKS = [
  { icon: '📦', bg: '#f3e8ff', label: 'Add Tracking', href: '/tasks/add-tracking' },
  { icon: '✅', bg: '#f3e8ff', label: 'My Tasks', href: '#' },
  { icon: '📁', bg: '#f5f5f5', label: 'HR Docs', href: '#' },
  { icon: '🏢', bg: '#f5f5f5', label: 'Vendors', href: '#' },
  { icon: '📝', bg: '#fff7ed', label: 'PTO Request', href: '#' },
  { icon: '➕', bg: '#f3e8ff', label: 'Add Customer', href: '#' },
]

// Fallback slides shown when the DB has no published slides yet
const FALLBACK_SLIDES: BannerSlide[] = [
  { id: 'f1', pre_heading: 'Our People', headline: 'The Dream Team', emoji: '🤝', subhead: 'Arcon Solutions · Eagan, MN', bg_type: 'gradient', bg_gradient: 'hs-1', bg_image_url: null },
  { id: 'f2', pre_heading: 'Upcoming', headline: 'Q1 All-Hands — March 20th', emoji: '📅', subhead: 'Zoom link and agenda coming by end of week', bg_type: 'gradient', bg_gradient: 'hs-2', bg_image_url: null },
  { id: 'f3', pre_heading: 'Company Win', headline: 'Record Orders in February', emoji: '📈', subhead: '23 orders processed yesterday — keep the momentum going!', bg_type: 'gradient', bg_gradient: 'hs-3', bg_image_url: null },
  { id: 'f4', pre_heading: '🎂 Birthday Today', headline: 'Happy Birthday, Brooke Bowlin!', emoji: '🎉', subhead: 'Wishing you a great day from the whole Arcon team', bg_type: 'gradient', bg_gradient: 'hs-4', bg_image_url: null },
  { id: 'f5', pre_heading: '5-Year Anniversary', headline: 'Congrats Cami Johnson — 5 Years!', emoji: '🥂', subhead: 'Thank you for five incredible years with Arcon', bg_type: 'gradient', bg_gradient: 'hs-5', bg_image_url: null },
]

// ── CRM Task types ────────────────────────────────────────────────────────────

type CrmTask = {
  id: string; title: string; status: string; priority: string
  due_date: string | null; category: string | null
  progress: number
  linked_to_name: string | null; linked_to_type: string | null
}

const CRM_PRIORITY_DOT: Record<string, string> = {
  high: 'dot-high', medium: 'dot-med', low: 'dot-low',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  not_started:                { label: 'Not Started',    color: '#94a3b8' },
  in_progress:                { label: 'In Progress',    color: '#60a5fa' },
  waiting_on_approval:        { label: 'Waiting Approval', color: '#fbbf24' },
  waiting_on_client_approval: { label: 'Waiting Client', color: '#fb923c' },
  need_changes:               { label: 'Need Changes',   color: '#f87171' },
  completed:                  { label: 'Completed',      color: '#4ade80' },
}
const STATUS_ORDER = Object.keys(STATUS_CONFIG)
const STATUS_NEXT: Record<string, string> = {
  not_started: 'in_progress',
  in_progress: 'waiting_on_approval',
  waiting_on_approval: 'waiting_on_client_approval',
  waiting_on_client_approval: 'completed',
  need_changes: 'in_progress',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAppUser()
  const [slides, setSlides] = useState<BannerSlide[]>([])
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [companyEvents, setCompanyEvents] = useState<CompanyCalendarEvent[]>([])
  const [eventTypes, setEventTypes] = useState<CompanyCalendarEventType[]>([])
  const [activeTypeIds, setActiveTypeIds] = useState<CompanyCalendarEventTypeId[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CompanyCalendarEvent | null>(null)
  const [bannerItems, setBannerItems] = useState<BannerStripItem[]>([])
  const [myTasks, setMyTasks] = useState<CrmTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)
  const [forms, setForms] = useState<CrmForm[]>([])
  const [formsSearch, setFormsSearch] = useState('')
  const [formsState, setFormsState] = useState('')

  useEffect(() => {
    fetch('/api/banner-strip')
      .then((r) => r.json())
      .then((data: { items: BannerStripItem[] }) => setBannerItems(data.items ?? []))
      .catch(() => {})
  }, [])


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
    fetch('/api/dashboard/events')
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Unable to load calendar events')
        return data as CompanyCalendarResponse
      })
      .then((data) => {
        setEventTypes(data.eventTypes ?? [])
        setActiveTypeIds((data.eventTypes ?? []).map((type) => type.id))
        setCompanyEvents(data.events ?? [])
        setSelectedEvent(data.events?.[0] ?? null)
        setEventsError(null)
      })
      .catch((error) => {
        setEventsError(error instanceof Error ? error.message : 'Unable to load calendar events')
      })
      .finally(() => setEventsLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/forms')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data?.forms)) setForms(data.forms) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/crm/tasks?assigned_to=me&status=not_started,in_progress,waiting_on_approval,waiting_on_client_approval,need_changes')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.tasks)) setMyTasks(data.tasks.slice(0, 8))
      })
      .catch(() => {})
      .finally(() => setTasksLoading(false))
  }, [])

  async function updateTaskStatus(taskId: string, newStatus: string) {
    setUpdatingTaskId(taskId)
    try {
      await fetch(`/api/crm/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      setMyTasks((prev) =>
        newStatus === 'completed'
          ? prev.filter((t) => t.id !== taskId)
          : prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t)
      )
    } finally {
      setUpdatingTaskId(null)
    }
  }

  function goTo(i: number) {
    const next = ((i % slides.length) + slides.length) % slides.length
    setCurrent(next)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 4800)
  }

  const eventTypeMap = useMemo(() => {
    return new Map(eventTypes.map((type) => [type.id, type]))
  }, [eventTypes])

  const filteredCompanyEvents = useMemo(() => {
    return companyEvents.filter((event) => activeTypeIds.includes(event.type))
  }, [activeTypeIds, companyEvents])

  const fullCalendarEvents = useMemo<EventInput[]>(() => {
    return filteredCompanyEvents.map((event) => {
      const type = eventTypeMap.get(event.type)
      return {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end ?? undefined,
        allDay: event.allDay,
        backgroundColor: type?.color ?? '#6b1e98',
        borderColor: type?.color ?? '#6b1e98',
        textColor: '#fff',
        extendedProps: { companyEvent: event },
      }
    })
  }, [eventTypeMap, filteredCompanyEvents])

  const eventsThisWeek = useMemo(() => countEventsThisWeek(companyEvents), [companyEvents])

  function toggleType(typeId: CompanyCalendarEventTypeId) {
    setActiveTypeIds((prev) =>
      prev.includes(typeId)
        ? prev.filter((id) => id !== typeId)
        : [...prev, typeId]
    )
  }

  function showAllTypes() {
    setActiveTypeIds(eventTypes.map((type) => type.id))
  }

  function renderCalendarEvent(info: EventContentArg) {
    const event = info.event.extendedProps.companyEvent as CompanyCalendarEvent | undefined
    const type = event ? eventTypeMap.get(event.type) : null
    return (
      <div className="arc-cal-event" title={event?.title ?? info.event.title}>
        <span className="arc-cal-dot" style={{ background: type?.accentColor ?? '#f3e8ff' }} />
        {info.timeText && <span className="arc-cal-time">{info.timeText}</span>}
        <span className="arc-cal-title">{info.event.title}</span>
      </div>
    )
  }

  function handleCalendarEventClick(info: EventClickArg) {
    const event = info.event.extendedProps.companyEvent as CompanyCalendarEvent | undefined
    if (event) setSelectedEvent(event)
  }

  function formatSelectedEventDate(event: CompanyCalendarEvent) {
    if (event.allDay) {
      return new Date(`${event.start}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    }

    const start = new Date(event.start)
    const end = event.end ? new Date(event.end) : null
    const date = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    const startTime = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    const endTime = end?.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return endTime ? `${date} · ${startTime}-${endTime}` : `${date} · ${startTime}`
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
        .task-item { padding: 9px 16px 10px; border-bottom: 1px solid #f5f5f5; }
        .task-item:last-child { border-bottom: none; }
        .task-item:hover { background: #faf5ff; }
        .task-row { display: flex; align-items: center; gap: 8px; }
        .task-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .dot-high { background: #dc2626; }
        .dot-med  { background: #f59e0b; }
        .dot-low  { background: #22c55e; }
        .task-name { font-size: 13px; color: #111; font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: none; }
        .task-name:hover { color: #6b1e98; }
        .task-meta { font-size: 11px; color: #aaa; margin-top: 2px; }
        .prog-bar { display: flex; height: 7px; margin-top: 7px; border-radius: 3px; overflow: hidden; background: #fff; }
        .prog-step { flex: 1; height: 100%; border: none; cursor: pointer; padding: 0; transition: filter 0.15s; clip-path: polygon(5px 0, calc(100% - 5px) 0, 100% 50%, calc(100% - 5px) 100%, 0 100%, 5px 50%); background: #f1f5f9; }
        .prog-step:first-child { clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 50%, calc(100% - 5px) 100%, 0 100%); }
        .prog-step:last-child  { clip-path: polygon(5px 0, 100% 0, 100% 100%, 0 100%, 5px 50%); }
        .prog-step.prog-past   { background: #ddd6fe; }
        .prog-step.prog-future { background: #f1f5f9; }
        .prog-step:hover:not(:disabled) { filter: brightness(0.88); }
        .prog-step:disabled { cursor: default; }
        .next-stage-btn { font-size: 10px; font-weight: 700; color: #6b1e98; background: #f3e8ff; border: none; border-radius: 4px; padding: 3px 8px; cursor: pointer; white-space: nowrap; flex-shrink: 0; line-height: 1.5; transition: background 0.12s; }
        .next-stage-btn:hover { background: #e9d5ff; }
        .next-stage-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        /* ── Events Calendar ── */
        .events-card .card-body { padding: 0; }
        .events-tools { padding: 10px 14px; display: flex; flex-wrap: wrap; gap: 7px; border-bottom: 1px solid #f3f4f6; }
        .event-filter { border: 1px solid #e5e7eb; border-radius: 999px; padding: 5px 10px; background: #fff; color: #555; font-size: 11px; font-weight: 700; cursor: pointer; line-height: 1; }
        .event-filter.active { border-color: #6b1e98; background: #f3e8ff; color: #6b1e98; }
        .event-filter-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; margin-right: 6px; }
        .calendar-shell { padding: 12px 14px 14px; }
        .calendar-empty, .calendar-error { font-size: 12px; color: #999; padding: 20px 14px; text-align: center; }
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
        .event-detail-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #aaa; margin-bottom: 5px; }
        .event-detail-title { font-size: 14px; font-weight: 800; color: #111; margin-bottom: 4px; }
        .event-detail-meta { font-size: 11px; color: #777; display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
        .event-type-pill { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 3px 8px; font-size: 10px; font-weight: 800; }
        .event-detail-desc { font-size: 12px; color: #555; margin-top: 8px; line-height: 1.45; white-space: pre-line; }

        /* ── Quick Links ── */
        .quick-link { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 8px 12px; text-align: center; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; text-decoration: none; display: block; }
        .quick-link:hover { border-color: #6b1e98; box-shadow: 0 0 0 3px #f3e8ff; }
        .ql-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin: 0 auto 7px; font-size: 17px; }
        .ql-label { font-size: 11px; font-weight: 600; color: #555; }

        /* ── Forms (dashboard) ── */
        .form-dash-row:hover { color: #6b1e98 !important; }

        /* ── Responsive layout ── */
        .dash-content { padding: 22px 28px 28px; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 22px; }
        .quick-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 24px; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        @media (max-width: 1023px) {
          .hero { height: 320px; }
          .stat-grid { grid-template-columns: repeat(2, 1fr); }
          .quick-grid { grid-template-columns: repeat(3, 1fr); }
          .two-col { grid-template-columns: 1fr; }
          .dash-content { padding: 18px 20px 24px; }
        }

        @media (max-width: 639px) {
          .hero { height: 220px; }
          .hero-title { font-size: 18px; }
          .hero-sub { font-size: 12px; }
          .hero-caption { padding: 0 16px 14px; }
          .dash-content { padding: 14px 14px 20px; }
          .stat-grid { gap: 10px; margin-bottom: 16px; }
          .quick-grid { gap: 8px; margin-bottom: 18px; }
          .two-col { gap: 12px; }
          .widget { padding: 12px 14px; }
          .arc-calendar .fc .fc-toolbar.fc-header-toolbar { align-items: flex-start; flex-direction: column; }
          .arc-calendar .fc .fc-toolbar-chunk { display: flex; gap: 4px; max-width: 100%; flex-wrap: wrap; }
          .arc-calendar .fc .fc-daygrid-day-frame { min-height: 58px; }
          .arc-cal-time { display: none; }
        }
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
      {bannerItems.length > 0 && (
        <div className="banner-strip">
          <div className="banner-inner">
            {/* Render twice for seamless loop */}
            {[...bannerItems, ...bannerItems].map((item, i) => (
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
                    <Link href={item.href} style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2 }}>
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


          {/* Stat widgets */}
        <div className="stat-grid">
          <div className="widget">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div className="widget-label">My Open Tasks</div>
                <div className="widget-value">{tasksLoading ? '—' : myTasks.length}</div>
                <div className="widget-sub">{tasksLoading ? 'Loading…' : myTasks.length === 0 ? 'All caught up!' : `${myTasks.filter((t) => t.priority === 'high').length} high priority`}</div>
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
                <div className="widget-label">Events This Week</div>
                <div className="widget-value">{eventsLoading ? '—' : eventsThisWeek}</div>
                <div className="widget-sub">{eventsLoading ? 'Loading…' : eventsThisWeek === 1 ? '1 event' : eventsThisWeek === 0 ? 'None this week' : `${eventsThisWeek} events`}</div>
              </div>
              <div className="widget-icon wi-gray">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M7 21h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            </div>
          </div>
        </div>

        {/* Quick links — hidden for now */}

        {/* Two-column section */}
        <div className="two-col">

          {/* Left column: My Tasks + Forms */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* My Tasks */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">My Tasks</div>
              <Link href="/my-tasks" className="card-action" style={{ textDecoration: 'none' }}>
                View all →
              </Link>
            </div>
            <div className="card-body" style={{ padding: '4px 0' }}>
              {tasksLoading ? (
                <div style={{ padding: '12px 16px' }}>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} style={{ height: 12, background: '#f5f5f5', borderRadius: 4, marginBottom: 10, width: i === 0 ? '70%' : i === 1 ? '55%' : '60%' }} />
                  ))}
                </div>
              ) : myTasks.length === 0 ? (
                <div style={{ fontSize: 12, color: '#bbb', padding: '12px 16px' }}>
                  No open tasks. <Link href="/crm/tasks/new" style={{ color: '#6b1e98', textDecoration: 'underline' }}>Create one →</Link>
                </div>
              ) : (
                myTasks.map((t) => {
                  const activeIdx = STATUS_ORDER.indexOf(t.status)
                  const isUpdating = updatingTaskId === t.id
                  return (
                    <div key={t.id} className="task-item">
                      <div className="task-row">
                        <div className={`task-dot ${CRM_PRIORITY_DOT[t.priority] ?? 'dot-med'}`} />
                        <Link href={`/crm/tasks/${t.id}`} className="task-name">{t.title}</Link>
                        {STATUS_NEXT[t.status] && (
                          <button
                            className="next-stage-btn"
                            disabled={isUpdating}
                            onClick={() => updateTaskStatus(t.id, STATUS_NEXT[t.status])}
                          >
                            {isUpdating ? '…' : `→ ${STATUS_CONFIG[STATUS_NEXT[t.status]].label}`}
                          </button>
                        )}
                      </div>
                      {t.due_date && (
                        <div className="task-meta">
                          <span style={{ color: new Date(t.due_date) < new Date() ? '#dc2626' : '#aaa', fontWeight: new Date(t.due_date) < new Date() ? 600 : 400 }}>
                            Due {new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {new Date(t.due_date) < new Date() ? ' ⚠️' : ''}
                            {t.linked_to_name ? ` · ${t.linked_to_name}` : ''}
                          </span>
                        </div>
                      )}
                      <div className="prog-bar" style={{ opacity: isUpdating ? 0.5 : 1 }}>
                        {STATUS_ORDER.map((s, i) => {
                          const pos = i < activeIdx ? 'past' : i === activeIdx ? 'active' : 'future'
                          return (
                            <button
                              key={s}
                              className={`prog-step prog-${pos}`}
                              title={STATUS_CONFIG[s].label}
                              disabled={isUpdating || s === t.status}
                              onClick={() => updateTaskStatus(t.id, s)}
                              style={pos === 'active' ? { background: STATUS_CONFIG[s].color } : undefined}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Forms */}
          {forms.length > 0 && (() => {
            const CATEGORY_LABELS: Record<string, string> = { vendor: 'Vendor', customer: 'Customer', general: 'General' }
            const allStates = [...new Set(forms.flatMap(f => f.states_covered))].sort()
            const searchLower = formsSearch.toLowerCase()
            const filtered = forms.filter(f => {
              const matchesSearch = !formsSearch || f.name.toLowerCase().includes(searchLower)
              const matchesState = !formsState || f.states_covered.length === 0 || f.states_covered.includes(formsState)
              return matchesSearch && matchesState
            })
            const grouped = ['vendor', 'customer', 'general'].map(cat => ({
              cat, label: CATEGORY_LABELS[cat],
              items: filtered.filter(f => f.category === cat),
            })).filter(g => g.items.length > 0)
            return (
              <div className="card">
                <div className="card-header" style={{ padding: '9px 14px' }}>
                  <div className="card-title" style={{ fontSize: 12 }}>Forms</div>
                  {user?.is_admin && (
                    <Link href="/admin/forms" className="card-action" style={{ textDecoration: 'none', fontSize: 11 }}>Manage →</Link>
                  )}
                </div>
                <div style={{ padding: '6px 14px 4px', display: 'flex', gap: 6, borderBottom: '1px solid #f3f4f6' }}>
                  <input
                    type="text"
                    placeholder="Search…"
                    value={formsSearch}
                    onChange={e => setFormsSearch(e.target.value)}
                    style={{ flex: 1, fontSize: 11, padding: '3px 7px', border: '1px solid #e5e7eb', borderRadius: 5, outline: 'none', minWidth: 0 }}
                  />
                  {allStates.length > 0 && (
                    <select
                      value={formsState}
                      onChange={e => setFormsState(e.target.value)}
                      style={{ fontSize: 11, padding: '3px 5px', border: '1px solid #e5e7eb', borderRadius: 5, outline: 'none', color: formsState ? '#111' : '#9ca3af', maxWidth: 120 }}
                    >
                      <option value="">All states</option>
                      {allStates.map(s => <option key={s} value={s}>{US_STATES[s] ?? s}</option>)}
                    </select>
                  )}
                </div>
                <div className="card-body" style={{ padding: '8px 14px' }}>
                  {grouped.length === 0 ? (
                    <div style={{ fontSize: 11, color: '#bbb' }}>No forms match.</div>
                  ) : grouped.map(({ cat, label, items }) => (
                    <div key={cat} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#bbb', marginBottom: 3 }}>{label}</div>
                      {items.map(form => (
                        <a
                          key={form.id}
                          href={form.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 0', textDecoration: 'none', color: '#374151' }}
                          className="form-dash-row"
                        >
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0, color: '#9ca3af', marginTop: 1 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.name}</div>
                            {form.description && (
                              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{form.description}</div>
                            )}
                          </div>
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0, opacity: 0.3, marginTop: 2 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          </div>{/* end left column */}

          {/* Company Events */}
          <div className="card events-card">
            <div className="card-header">
              <div className="card-title">Company Calendar</div>
              <a
                href="https://calendar.google.com/calendar/u/0?cid=Y19lNDNlMDkyODZiMzM3MGZhNjQzZGE0OTExZjA2MWZhZDc1MmIzMzkwODMxNDg2MzVlM2M0ZTUzMzk2Yjk4ODk3QGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20"
                target="_blank"
                rel="noopener noreferrer"
                className="card-action"
                style={{ textDecoration: 'none' }}
              >
                Open Google Calendar →
              </a>
            </div>
            <div className="events-tools">
              <button
                type="button"
                className={`event-filter${activeTypeIds.length === eventTypes.length && eventTypes.length > 0 ? ' active' : ''}`}
                onClick={showAllTypes}
              >
                All
              </button>
              {eventTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className={`event-filter${activeTypeIds.includes(type.id) ? ' active' : ''}`}
                  onClick={() => toggleType(type.id)}
                >
                  <span className="event-filter-dot" style={{ background: type.color }} />
                  {type.label}
                </button>
              ))}
            </div>
            {eventsLoading ? (
              <div className="calendar-skeleton">
                <div className="calendar-skeleton-row" style={{ width: '42%' }} />
                <div className="calendar-skeleton-row" style={{ width: '100%', height: 220 }} />
              </div>
            ) : eventsError ? (
              <div className="calendar-error">{eventsError}</div>
            ) : (
              <>
                <div className="calendar-shell arc-calendar">
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{
                      left: 'prev,next today',
                      center: 'title',
                      right: 'dayGridMonth,timeGridWeek,listMonth',
                    }}
                    buttonText={{
                      today: 'Today',
                      month: 'Month',
                      week: 'Week',
                      list: 'List',
                    }}
                    events={fullCalendarEvents}
                    eventContent={renderCalendarEvent}
                    eventClick={handleCalendarEventClick}
                    height="auto"
                    dayMaxEvents={3}
                    nowIndicator
                  />
                  {fullCalendarEvents.length === 0 && (
                    <div className="calendar-empty">No events match the selected filters.</div>
                  )}
                </div>
                {selectedEvent && activeTypeIds.includes(selectedEvent.type) && (() => {
                  const type = eventTypeMap.get(selectedEvent.type)
                  return (
                    <div className="event-detail">
                      <div className="event-detail-label">Selected Event</div>
                      <div className="event-detail-title">{selectedEvent.title}</div>
                      <div className="event-detail-meta">
                        <span
                          className="event-type-pill"
                          style={{ background: type?.accentColor ?? '#f3e8ff', color: type?.color ?? '#6b1e98' }}
                        >
                          <span className="event-filter-dot" style={{ background: type?.color ?? '#6b1e98', marginRight: 0 }} />
                          {selectedEvent.typeLabel}
                        </span>
                        <span>{formatSelectedEventDate(selectedEvent)}</span>
                        {selectedEvent.location && <span>{selectedEvent.location}</span>}
                      </div>
                      {selectedEvent.description && (
                        <div className="event-detail-desc">{selectedEvent.description}</div>
                      )}
                    </div>
                  )
                })()}
              </>
              )}
          </div>

        </div>

      </div>
    </>
  )
}
