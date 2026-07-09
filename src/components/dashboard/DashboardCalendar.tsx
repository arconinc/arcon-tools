'use client'

import { useState, useEffect, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import { EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core'
import {
  CompanyCalendarEvent,
  CompanyCalendarEventType,
  CompanyCalendarEventTypeId,
  CompanyCalendarResponse,
} from '@/types'
import { FilterPill } from '@/components/ui'

const EVENT_TYPE_ICONS: Record<string, (color: string) => React.ReactNode> = {
  birthday: (color) => (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', flexShrink: 0 }}>
      <path d="M8 1c.6 0 1 .5.8 1L8 4 7.2 2c-.2-.5.2-1 .8-1z" fill={color}/>
      <rect x="2" y="7" width="12" height="8" rx="1.5" fill={color} opacity=".25"/>
      <path d="M2 10h12v1H2z" fill={color}/>
      <rect x="2" y="7" width="12" height="8" rx="1.5" stroke={color} strokeWidth="1.2" fill="none"/>
      <circle cx="5.5" cy="4.5" r="1" fill={color}/>
      <circle cx="10.5" cy="4.5" r="1" fill={color}/>
      <path d="M5.5 3.5V6M10.5 3.5V6" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  anniversary: (color) => (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', flexShrink: 0 }}>
      <path d="M8 2.5C5.5 2.5 3 4.5 3 7c0 3 5 6.5 5 6.5s5-3.5 5-6.5c0-2.5-2.5-4.5-5-4.5z" fill={color} opacity=".25" stroke={color} strokeWidth="1.2"/>
      <circle cx="8" cy="7" r="2" fill={color}/>
    </svg>
  ),
  company: (color) => (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', flexShrink: 0 }}>
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke={color} strokeWidth="1.2" fill={color} fillOpacity=".15"/>
      <path d="M2 5.5h12" stroke={color} strokeWidth="1.2"/>
      <circle cx="5" cy="3.75" r=".8" fill={color}/>
      <circle cx="11" cy="3.75" r=".8" fill={color}/>
      <rect x="5" y="8" width="2" height="2" rx=".4" fill={color}/>
      <rect x="9" y="8" width="2" height="2" rx=".4" fill={color}/>
    </svg>
  ),
  pto: (color) => (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', flexShrink: 0 }}>
      <circle cx="8" cy="8" r="5.5" stroke={color} strokeWidth="1.2" fill={color} fillOpacity=".15"/>
      <path d="M8 5v3.5l2 2" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  vendor_demo: (color) => (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', flexShrink: 0 }}>
      <rect x="1.5" y="3" width="13" height="9" rx="1.5" stroke={color} strokeWidth="1.2" fill={color} fillOpacity=".15"/>
      <path d="M6 7l3 1.5L6 10V7z" fill={color}/>
    </svg>
  ),
}

export default function DashboardCalendar() {
  const [companyEvents, setCompanyEvents] = useState<CompanyCalendarEvent[]>([])
  const [eventTypes, setEventTypes] = useState<CompanyCalendarEventType[]>([])
  const [activeTypeIds, setActiveTypeIds] = useState<CompanyCalendarEventTypeId[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CompanyCalendarEvent | null>(null)

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
        {event?.type && EVENT_TYPE_ICONS[event.type]
          ? EVENT_TYPE_ICONS[event.type](type?.accentColor ?? '#f3e8ff')
          : <span className="arc-cal-dot" style={{ background: type?.accentColor ?? '#f3e8ff' }} />}
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

  const allTypesActive = activeTypeIds.length === eventTypes.length && eventTypes.length > 0

  return (
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
        <FilterPill
          value="all"
          label="All"
          active={allTypesActive}
          onClick={showAllTypes}
          style={allTypesActive ? undefined : { borderColor: '#6b1e98', color: '#6b1e98' }}
        />
        {eventTypes.map((type) => {
          const active = activeTypeIds.includes(type.id)
          return (
            <FilterPill
              key={type.id}
              value={type.id}
              label={type.label}
              active={active}
              onClick={() => toggleType(type.id)}
              icon={EVENT_TYPE_ICONS[type.id] ? EVENT_TYPE_ICONS[type.id](active ? '#fff' : type.color) : <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#fff' : type.color, display: 'inline-block' }} />}
              style={{
                background: active ? type.color : '#fff',
                borderColor: type.color,
                color: active ? '#fff' : type.color,
              }}
            />
          )
        })}
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
                    {type && EVENT_TYPE_ICONS[type.id] ? EVENT_TYPE_ICONS[type.id](type.color) : <span className="event-filter-dot" style={{ background: type?.color ?? '#6b1e98', marginRight: 0 }} />}
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
  )
}
