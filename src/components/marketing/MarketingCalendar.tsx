'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction'
import { EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core'
import { MarketingCalendarEvent, MarketingCalendarPlatform } from '@/types'
import { FilterPill, SocialIcon } from '@/components/ui'
import CalendarEventModal from './CalendarEventModal'

const PLATFORM_META: Record<MarketingCalendarPlatform, { label: string; color: string }> = {
  linkedin: { label: 'LinkedIn', color: '#0A66C2' },
  mailchimp: { label: 'MailChimp', color: '#FFE01B' },
  instagram: { label: 'Instagram', color: '#E1306C' },
  facebook: { label: 'Facebook', color: '#1877F2' },
}

const ALL_PLATFORMS = Object.keys(PLATFORM_META) as MarketingCalendarPlatform[]

export default function MarketingCalendar() {
  const [events, setEvents] = useState<MarketingCalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activePlatforms, setActivePlatforms] = useState<MarketingCalendarPlatform[]>(ALL_PLATFORMS)
  const [selectedEvent, setSelectedEvent] = useState<MarketingCalendarEvent | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalDate, setModalDate] = useState<string | undefined>(undefined)

  const loadEvents = useCallback(() => {
    setLoading(true)
    fetch('/api/marketing/calendar-events')
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Unable to load calendar events')
        return data as { items: MarketingCalendarEvent[] }
      })
      .then((data) => {
        setEvents(data.items ?? [])
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load calendar events'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadEvents()
    fetch('/api/marketing/calendar-events/can-edit')
      .then((r) => r.json())
      .then((data) => setCanEdit(Boolean(data.canEdit)))
      .catch(() => setCanEdit(false))
  }, [loadEvents])

  const filteredEvents = useMemo(
    () => events.filter((e) => e.platforms.some((p) => activePlatforms.includes(p)) || e.platforms.length === 0),
    [events, activePlatforms]
  )

  const fullCalendarEvents = useMemo<EventInput[]>(() => {
    return filteredEvents.map((event) => {
      const primaryPlatform = event.platforms[0]
      const color = primaryPlatform ? PLATFORM_META[primaryPlatform].color : '#6b1e98'
      return {
        id: event.id,
        title: event.title,
        start: event.event_time ? `${event.event_date}T${event.event_time}` : event.event_date,
        allDay: !event.event_time,
        backgroundColor: color,
        borderColor: color,
        textColor: '#fff',
        extendedProps: { calendarEvent: event },
      }
    })
  }, [filteredEvents])

  function togglePlatform(platform: MarketingCalendarPlatform) {
    setActivePlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    )
  }

  function renderCalendarEvent(info: EventContentArg) {
    const event = info.event.extendedProps.calendarEvent as MarketingCalendarEvent | undefined
    return (
      <div className="arc-cal-event" title={event?.title ?? info.event.title}>
        {info.timeText && <span className="arc-cal-time">{info.timeText}</span>}
        <span className="arc-cal-title">{info.event.title}</span>
      </div>
    )
  }

  function handleEventClick(info: EventClickArg) {
    const event = info.event.extendedProps.calendarEvent as MarketingCalendarEvent | undefined
    if (event) setSelectedEvent(event)
  }

  function handleDateClick(info: DateClickArg) {
    if (!canEdit) return
    setModalDate(info.dateStr.slice(0, 10))
    setShowModal(true)
  }

  function formatEventDate(event: MarketingCalendarEvent) {
    const date = new Date(`${event.event_date}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    if (!event.event_time) return date
    const time = new Date(`${event.event_date}T${event.event_time}`).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
    return `${date} · ${time}`
  }

  async function handleDelete(event: MarketingCalendarEvent) {
    if (!confirm(`Delete "${event.title}"?`)) return
    const res = await fetch(`/api/marketing/calendar-events/${event.id}`, { method: 'DELETE' })
    if (res.ok) {
      setSelectedEvent(null)
      loadEvents()
    }
  }

  const allActive = activePlatforms.length === ALL_PLATFORMS.length

  return (
    <div className="card events-card">
      <div className="card-header">
        <div className="card-title">Marketing Calendar</div>
        {canEdit && (
          <button
            type="button"
            className="card-action"
            onClick={() => {
              setModalDate(undefined)
              setShowModal(true)
            }}
          >
            + Add Event
          </button>
        )}
      </div>
      <div className="events-tools">
        <FilterPill
          value="all"
          label="All"
          active={allActive}
          onClick={() => setActivePlatforms(allActive ? [] : ALL_PLATFORMS)}
          style={allActive ? undefined : { borderColor: '#6b1e98', color: '#6b1e98' }}
        />
        {ALL_PLATFORMS.map((platform) => {
          const meta = PLATFORM_META[platform]
          const active = activePlatforms.includes(platform)
          return (
            <FilterPill
              key={platform}
              value={platform}
              label={meta.label}
              active={active}
              onClick={() => togglePlatform(platform)}
              icon={<SocialIcon name={platform} />}
              style={{
                background: active ? meta.color : '#fff',
                borderColor: meta.color,
                color: active ? (platform === 'mailchimp' ? '#111' : '#fff') : meta.color,
              }}
            />
          )
        })}
      </div>
      {loading ? (
        <div className="calendar-skeleton">
          <div className="calendar-skeleton-row" style={{ width: '42%' }} />
          <div className="calendar-skeleton-row" style={{ width: '100%', height: 220 }} />
        </div>
      ) : error ? (
        <div className="calendar-error">{error}</div>
      ) : (
        <>
          <div className="calendar-shell arc-calendar">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,listMonth',
              }}
              buttonText={{ today: 'Today', month: 'Month', week: 'Week', list: 'List' }}
              events={fullCalendarEvents}
              eventContent={renderCalendarEvent}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              dayCellClassNames={canEdit ? 'arc-cal-day-clickable' : undefined}
              height="auto"
              dayMaxEvents={3}
              nowIndicator
            />
            {fullCalendarEvents.length === 0 && (
              <div className="calendar-empty">No events match the selected filters.</div>
            )}
          </div>
          {selectedEvent && (
            <div className="event-detail">
              <div className="event-detail-label">Selected Event</div>
              <div className="event-detail-title">{selectedEvent.title}</div>
              <div className="event-detail-meta">
                {selectedEvent.platforms.map((p) => (
                  <span
                    key={p}
                    className="event-type-pill"
                    style={{ background: `${PLATFORM_META[p].color}22`, color: PLATFORM_META[p].color }}
                  >
                    <SocialIcon name={p} />
                    {PLATFORM_META[p].label}
                  </span>
                ))}
                <span>{formatEventDate(selectedEvent)}</span>
              </div>
              {selectedEvent.art_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedEvent.art_url}
                  alt={selectedEvent.title}
                  className="event-detail-art"
                />
              )}
              {canEdit && (
                <button type="button" className="event-detail-delete" onClick={() => handleDelete(selectedEvent)}>
                  Delete Event
                </button>
              )}
            </div>
          )}
        </>
      )}
      {showModal && (
        <CalendarEventModal
          initialDate={modalDate}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            loadEvents()
          }}
        />
      )}
    </div>
  )
}
