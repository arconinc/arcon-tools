'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction'
import { EventClickArg, EventInput } from '@fullcalendar/core'
import { VendorDemoSlot } from '@/types'
import VendorSlotModal from './VendorSlotModal'

const OPEN_COLOR = '#9ca3af'
const RESERVED_COLOR = '#6b1e98'

export default function VendorRelationsCalendar() {
  const [slots, setSlots] = useState<VendorDemoSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<VendorDemoSlot | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalDate, setModalDate] = useState<string | undefined>(undefined)

  const loadSlots = useCallback(() => {
    setLoading(true)
    fetch('/api/marketing/vendor-relations/slots')
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? 'Unable to load time slots')
        return data as { items: VendorDemoSlot[] }
      })
      .then((data) => {
        setSlots(data.items ?? [])
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load time slots'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadSlots()
    fetch('/api/marketing/vendor-relations/slots/can-edit')
      .then((r) => r.json())
      .then((data) => setCanEdit(Boolean(data.canEdit)))
      .catch(() => setCanEdit(false))
  }, [loadSlots])

  const fullCalendarEvents = useMemo<EventInput[]>(() => {
    return slots.map((slot) => {
      const color = slot.status === 'reserved' ? RESERVED_COLOR : OPEN_COLOR
      return {
        id: slot.id,
        title: slot.status === 'reserved' ? (slot.vendor?.name ?? 'Reserved') : 'Open',
        start: slot.start_time,
        end: slot.end_time,
        backgroundColor: color,
        borderColor: color,
        textColor: '#fff',
        extendedProps: { slot },
      }
    })
  }, [slots])

  function handleEventClick(info: EventClickArg) {
    const slot = info.event.extendedProps.slot as VendorDemoSlot | undefined
    if (slot) setSelectedSlot(slot)
  }

  function handleDateClick(info: DateClickArg) {
    if (!canEdit) return
    setModalDate(info.dateStr.slice(0, 10))
    setShowModal(true)
  }

  function formatSlotRange(slot: VendorDemoSlot) {
    const start = new Date(slot.start_time)
    const end = new Date(slot.end_time)
    const dateLabel = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    const startLabel = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    const endLabel = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return `${dateLabel} · ${startLabel} – ${endLabel}`
  }

  function buildGoogleCalendarUrl(slot: VendorDemoSlot) {
    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const start = fmt(new Date(slot.start_time))
    const end = fmt(new Date(slot.end_time))
    const title = slot.status === 'reserved' ? `Vendor Demo – ${slot.vendor?.name ?? 'Vendor'}` : 'Vendor Demo (Open Slot)'
    const details = slot.vendor_notes ? encodeURIComponent(slot.vendor_notes) : ''
    const text = encodeURIComponent(title)
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}`
  }

  async function handleDelete(slot: VendorDemoSlot) {
    const message =
      slot.status === 'reserved'
        ? `${slot.vendor?.name ?? 'A vendor'} has already booked this time. Delete it anyway?`
        : 'Delete this open time slot?'
    if (!confirm(message)) return
    const res = await fetch(`/api/marketing/vendor-relations/slots/${slot.id}`, { method: 'DELETE' })
    if (res.ok) {
      setSelectedSlot(null)
      loadSlots()
    }
  }

  return (
    <div className="card events-card">
      <div className="card-header">
        <div className="card-title">Vendor Demo Time Slots</div>
        {canEdit && (
          <button
            type="button"
            className="card-action"
            onClick={() => {
              setModalDate(undefined)
              setShowModal(true)
            }}
          >
            + Add Time Slot
          </button>
        )}
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
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'timeGridWeek,dayGridMonth',
              }}
              buttonText={{ today: 'Today', month: 'Month', week: 'Week' }}
              events={fullCalendarEvents}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              dayCellClassNames={canEdit ? 'arc-cal-day-clickable' : undefined}
              height="auto"
              nowIndicator
              slotMinTime="07:00:00"
              slotMaxTime="19:00:00"
            />
            {fullCalendarEvents.length === 0 && (
              <div className="calendar-empty">No time slots yet.</div>
            )}
          </div>
          {selectedSlot && (
            <div className="event-detail">
              <div className="event-detail-label">{selectedSlot.status === 'reserved' ? 'Booked Demo' : 'Open Slot'}</div>
              <div className="event-detail-title">{selectedSlot.status === 'reserved' ? selectedSlot.vendor?.name : 'Open Time Slot'}</div>
              <div className="event-detail-meta">
                <span>{formatSlotRange(selectedSlot)}</span>
              </div>
              {selectedSlot.vendor_notes && (
                <p style={{ fontSize: 12, color: '#555', marginTop: 8 }}>{selectedSlot.vendor_notes}</p>
              )}
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href={buildGoogleCalendarUrl(selectedSlot)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Create an event in Google Calendar and invite the team"
                  style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#6b1e98', textDecoration: 'none', borderRadius: 6, padding: '5px 10px', display: 'inline-block' }}
                >
                  📅 Create Event
                </a>
                {canEdit && (
                  <button type="button" onClick={() => handleDelete(selectedSlot)} style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M6 2a1 1 0 0 0-1 1v.5H2.5a.5.5 0 0 0 0 1H3v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-9h.5a.5.5 0 0 0 0-1H11V3a1 1 0 0 0-1-1H6zm1 1h2v.5H7V3zm-3 2h8v9H4V5zm2 1.5a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0V7a.5.5 0 0 0-.5-.5zm2 0a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0V7a.5.5 0 0 0-.5-.5zm2 0a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0V7a.5.5 0 0 0-.5-.5z"/></svg>
                    Delete Time Slot
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
      {showModal && (
        <VendorSlotModal
          initialDate={modalDate}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            loadSlots()
          }}
        />
      )}
    </div>
  )
}
