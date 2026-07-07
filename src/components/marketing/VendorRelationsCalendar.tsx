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
              {canEdit && (
                <button type="button" className="event-detail-delete" onClick={() => handleDelete(selectedSlot)}>
                  Delete Time Slot
                </button>
              )}
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
