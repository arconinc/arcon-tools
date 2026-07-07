'use client'

import dynamic from 'next/dynamic'

const VendorRelationsCalendar = dynamic(() => import('@/components/marketing/VendorRelationsCalendar'), {
  ssr: false,
  loading: () => (
    <div className="card events-card">
      <div className="card-header">
        <div className="card-title">Vendor Demo Time Slots</div>
      </div>
      <div className="calendar-skeleton">
        <div className="calendar-skeleton-row" style={{ width: '42%' }} />
        <div className="calendar-skeleton-row" style={{ width: '100%', height: 220 }} />
      </div>
    </div>
  ),
})

export default function VendorRelationsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-purple-600">Marketing</p>
        <h1 className="text-2xl font-bold text-slate-950">Vendor Relations</h1>
        <p className="mt-1 text-sm text-slate-600">Define open demo time slots for vendors to book, and see who&apos;s reserved a spot.</p>
      </div>

      <VendorRelationsCalendar />

      <style jsx global>{`
        /* ── Cards ── */
        .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
        .card-header { padding: 13px 16px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; }
        .card-title { font-size: 13px; font-weight: 700; color: #111; }
        .card-action { font-size: 12px; color: #6b1e98; cursor: pointer; font-weight: 600; border-radius: 4px; background: none; border: none; padding: 0; }

        /* ── Events Calendar ── */
        .events-card .card-body { padding: 0; }
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
        .arc-cal-day-clickable { cursor: pointer; }
        .arc-cal-day-clickable:hover { background: #faf5ff; }
        .arc-calendar .fc .fc-event { border-radius: 5px; border: 0; padding: 1px 3px; cursor: pointer; }
        .arc-calendar .fc .fc-daygrid-event { margin: 1px 4px; }
        .event-detail { border-top: 1px solid #f3f4f6; padding: 12px 14px; background: #fafafa; }
        .event-detail-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 5px; }
        .event-detail-title { font-size: 14px; font-weight: 800; color: #111; margin-bottom: 4px; }
        .event-detail-meta { font-size: 11px; color: #777; display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
        .event-detail-delete { margin-top: 10px; font-size: 11px; font-weight: 700; color: #b91c1c; background: none; border: none; cursor: pointer; padding: 0; }

        @media (max-width: 639px) {
          .arc-calendar .fc .fc-toolbar.fc-header-toolbar { align-items: flex-start; flex-direction: column; }
          .arc-calendar .fc .fc-toolbar-chunk { display: flex; gap: 4px; max-width: 100%; flex-wrap: wrap; }
          .arc-calendar .fc .fc-daygrid-day-frame { min-height: 58px; }
        }

        /* ── Add Time Slot Modal ── */
        .cal-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px; }
        .cal-modal { background: #fff; border-radius: 12px; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; }
        .cal-modal-header { padding: 14px 18px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; }
        .cal-modal-title { font-size: 14px; font-weight: 800; color: #111; }
        .cal-modal-close { background: none; border: none; font-size: 20px; line-height: 1; color: #6b7280; cursor: pointer; }
        .cal-modal-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
        .cal-modal-field { display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 700; color: #374151; }
        .cal-modal-field input[type="text"], .cal-modal-field input[type="date"], .cal-modal-field input[type="time"] {
          font-weight: 400; font-size: 13px; padding: 7px 10px; border: 1px solid #e5e7eb; border-radius: 6px; color: #111;
        }
        .cal-modal-row { display: flex; gap: 12px; }
        .cal-modal-row .cal-modal-field { flex: 1; }
        .cal-modal-error { font-size: 12px; color: #b91c1c; }
        .cal-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
        .cal-modal-cancel { font-size: 12px; font-weight: 700; color: #6b7280; background: none; border: none; cursor: pointer; padding: 8px 10px; }
        .cal-modal-save { font-size: 12px; font-weight: 700; color: #fff; background: #6b1e98; border: none; border-radius: 6px; cursor: pointer; padding: 8px 14px; }
        .cal-modal-save:disabled, .cal-modal-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
