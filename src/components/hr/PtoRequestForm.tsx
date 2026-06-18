'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppUser } from '@/components/layout/AppShell'
import { PtoRequest, PtoReason } from '@/types'

interface Props {
  existing?: PtoRequest
}

const REASON_TILES: { value: PtoReason; label: string; icon: string }[] = [
  { value: 'vacation',            label: 'Vacation',    icon: '🧳' },
  { value: 'personal_leave',      label: 'Personal',    icon: '🙋' },
  { value: 'medical_leave',       label: 'Medical',     icon: '🏥' },
  { value: 'funeral_bereavement', label: 'Bereavement', icon: '🕊️' },
  { value: 'family_reasons',      label: 'Family',      icon: '👨‍👩‍👧' },
  { value: 'jury_duty',           label: 'Jury Duty',   icon: '⚖️' },
  { value: 'to_vote',             label: 'To Vote',     icon: '🗳️' },
  { value: 'other',               label: 'Other',       icon: '📋' },
]

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa']

function toYMD(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}
function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate()
}
function firstDow(y: number, m: number) {
  return new Date(y, m, 1).getDay()
}
function addMonths(y: number, m: number, delta: number): [number, number] {
  const d = new Date(y, m + delta, 1)
  return [d.getFullYear(), d.getMonth()]
}
function friendlyDate(ymd: string) {
  const [y, mo, d] = ymd.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function daysBetween(a: string, b: string) {
  const d1 = new Date(a), d2 = new Date(b)
  return Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1
}

function CalendarMonth({
  year, month, startDate, endDate, hoverDate, onDayClick, onDayHover,
}: {
  year: number
  month: number
  startDate: string
  endDate: string
  hoverDate: string
  onDayClick: (ymd: string) => void
  onDayHover: (ymd: string) => void
}) {
  const today = todayYMD()
  const days = daysInMonth(year, month)
  const offset = firstDow(year, month)
  const rangeEnd = endDate || hoverDate

  const cells: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= days; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div style={{ flex: '1 1 260px', minWidth: 240 }}>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, color: '#1e1b4b', marginBottom: 10 }}>
        {MONTHS[month]} {year}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0 }}>
        {DOW.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9ca3af', paddingBottom: 6 }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const ymd = toYMD(year, month, day)
          const isPast = ymd < today
          const isStart = ymd === startDate
          const isEnd = ymd === endDate
          const inRange = startDate && rangeEnd && ymd > (startDate < rangeEnd ? startDate : rangeEnd) && ymd < (startDate < rangeEnd ? rangeEnd : startDate)
          const isRangeStart = startDate && rangeEnd && ymd === (startDate < rangeEnd ? startDate : rangeEnd)
          const isRangeEnd = startDate && rangeEnd && ymd === (startDate < rangeEnd ? rangeEnd : startDate)
          const isSelected = isStart || isEnd

          let bg = 'transparent'
          let color = '#111'
          let borderRadius = '50%'
          let rangeBg = 'transparent'

          if (isRangeStart && isRangeEnd) {
            bg = '#6b1e98'; color = '#fff'
          } else if (isRangeStart) {
            bg = '#6b1e98'; color = '#fff'
            rangeBg = 'linear-gradient(to right, transparent 50%, #ede9fe 50%)'
            borderRadius = '50% 0 0 50%'
          } else if (isRangeEnd) {
            bg = '#6b1e98'; color = '#fff'
            rangeBg = 'linear-gradient(to left, transparent 50%, #ede9fe 50%)'
            borderRadius = '0 50% 50% 0'
          } else if (inRange) {
            bg = '#ede9fe'; color = '#5b21b6'; borderRadius = '0'
          }

          return (
            <div
              key={i}
              style={{ position: 'relative', padding: '1px 0' }}
              onMouseEnter={() => !isPast && onDayHover(ymd)}
            >
              {(inRange || isRangeStart || isRangeEnd) && !isSelected && (
                <div style={{ position: 'absolute', inset: '1px 0', background: '#ede9fe', borderRadius: (isRangeStart && !isRangeEnd) ? '50% 0 0 50%' : (isRangeEnd && !isRangeStart) ? '0 50% 50% 0' : '0' }} />
              )}
              {isRangeStart && !isRangeEnd && (
                <div style={{ position: 'absolute', inset: '1px 0', background: 'linear-gradient(to right, transparent 50%, #ede9fe 50%)' }} />
              )}
              {isRangeEnd && !isRangeStart && (
                <div style={{ position: 'absolute', inset: '1px 0', background: 'linear-gradient(to left, transparent 50%, #ede9fe 50%)' }} />
              )}
              <button
                type="button"
                onClick={() => !isPast && onDayClick(ymd)}
                disabled={isPast}
                style={{
                  position: 'relative',
                  width: 34, height: 34,
                  borderRadius: (isRangeStart || isRangeEnd || isSelected) ? '50%' : (inRange ? '0' : '50%'),
                  background: isSelected ? '#6b1e98' : inRange ? '#ede9fe' : 'transparent',
                  color: isPast ? '#d1d5db' : isSelected ? '#fff' : inRange ? '#5b21b6' : '#111',
                  border: 'none',
                  cursor: isPast ? 'default' : 'pointer',
                  fontSize: 13,
                  fontWeight: isSelected ? 700 : 400,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto',
                  zIndex: 1,
                  textDecoration: isPast ? 'line-through' : 'none',
                }}
              >
                {day}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function todayYMD() {
  const n = new Date()
  return toYMD(n.getFullYear(), n.getMonth(), n.getDate())
}

function today() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function PtoRequestForm({ existing }: Props) {
  const router = useRouter()
  const { user } = useAppUser()

  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [startDate, setStartDate] = useState(existing?.start_date ?? '')
  const [endDate, setEndDate] = useState(existing?.end_date ?? '')
  const [hoverDate, setHoverDate] = useState('')
  const [selecting, setSelecting] = useState<'start' | 'end'>('start')
  const [startHalf, setStartHalf] = useState(existing?.start_half_day ?? false)
  const [endHalf, setEndHalf] = useState(existing?.end_half_day ?? false)
  const [reason, setReason] = useState<PtoReason | ''>(existing?.reason ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [signedName, setSignedName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [rightYear, rightMonth] = addMonths(calYear, calMonth, 1)

  function handleDayClick(ymd: string) {
    if (selecting === 'start' || !startDate) {
      setStartDate(ymd)
      setEndDate(ymd)
      setSelecting('end')
    } else {
      if (ymd < startDate) {
        setEndDate(startDate)
        setStartDate(ymd)
      } else {
        setEndDate(ymd)
      }
      setSelecting('start')
    }
  }

  function handlePrev() {
    const [y, m] = addMonths(calYear, calMonth, -1)
    setCalYear(y); setCalMonth(m)
  }
  function handleNext() {
    const [y, m] = addMonths(calYear, calMonth, 1)
    setCalYear(y); setCalMonth(m)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!startDate || !endDate || !reason || !signedName.trim()) {
      setError('Please fill in all required fields and type your name to confirm.')
      return
    }
    setSaving(true)
    try {
      const url = existing ? `/api/hr/pto/${existing.id}` : '/api/hr/pto'
      const method = existing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          start_half_day: startHalf,
          end_half_day: endHalf,
          reason,
          notes: notes.trim() || null,
          signed_name: signedName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Submission failed'); return }
      router.push('/hr/pto')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const rawDays = startDate && endDate ? daysBetween(startDate, endDate) : null
  const halfDeductions = (startHalf ? 0.5 : 0) + (endHalf && endDate !== startDate ? 0.5 : 0) + (endHalf && endDate === startDate ? 0.5 : 0)
  const dayCount = rawDays !== null ? rawDays - halfDeductions : null
  const dayCountLabel = dayCount === null ? null : Number.isInteger(dayCount) ? `${dayCount} day${dayCount !== 1 ? 's' : ''}` : `${Math.floor(dayCount)} ½ days`

  return (
    <>
      <style>{`
        .pto-form-page { padding: 28px 32px; max-width: 1200px; margin: 0 auto; }
        .pto-form-inner { max-width: 640px; }
        .pto-form-title { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 24px; }
        .form-section { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px 22px; margin-bottom: 16px; }
        .form-section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: #888; margin-bottom: 14px; }
        .form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
        .form-group:last-child { margin-bottom: 0; }
        .form-label { font-size: 12px; font-weight: 700; color: #444; }
        .form-input, .form-textarea { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 10px; font-size: 13px; color: #111; background: #fff; width: 100%; box-sizing: border-box; }
        .form-input:focus, .form-textarea:focus { outline: 2px solid #6b1e98; border-color: #6b1e98; }
        .form-textarea { resize: vertical; min-height: 80px; }
        .form-checkbox-row { display: flex; align-items: center; gap: 7px; }
        .form-checkbox-row input { width: 15px; height: 15px; cursor: pointer; accent-color: #6b1e98; }
        .form-checkbox-row label { font-size: 12px; color: #555; cursor: pointer; }
        .signature-box { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 4px; }
        .signature-agreement { font-size: 12px; color: #555; line-height: 1.6; margin-bottom: 14px; }
        .signature-date { font-size: 11px; color: #888; margin-top: 8px; }
        .form-error { background: #fee2e2; border: 1px solid #fca5a5; border-radius: 7px; color: #991b1b; font-size: 13px; padding: 10px 14px; margin-bottom: 14px; }
        .form-actions { display: flex; gap: 10px; margin-top: 4px; }
        .btn-submit { background: #6b1e98; color: #fff; border: none; border-radius: 7px; padding: 10px 22px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .btn-submit:hover:not(:disabled) { background: #581580; }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-cancel { background: #f3f4f6; color: #555; border: 1px solid #e5e7eb; border-radius: 7px; padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
        .btn-cancel:hover { background: #e5e7eb; }
        .reason-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
        .reason-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 14px 10px; border: 2px solid #e5e7eb; border-radius: 10px; background: #fff; cursor: pointer; transition: border-color .15s, background .15s; font-size: 12px; font-weight: 600; color: #444; text-align: center; line-height: 1.3; }
        .reason-tile:hover { border-color: #a855f7; background: #faf5ff; }
        .reason-tile.selected { border-color: #6b1e98; background: #f3e8ff; color: #6b1e98; }
        .reason-tile .reason-icon { font-size: 22px; line-height: 1; }
        .cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .cal-nav-btn { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; width: 30px; height: 30px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
        .cal-nav-btn:hover { background: #e5e7eb; }
        .cal-months { display: flex; gap: 32px; flex-wrap: wrap; }
        .cal-summary { display: flex; align-items: center; gap: 10px; margin-top: 16px; padding: 12px 14px; background: #f3e8ff; border-radius: 8px; font-size: 13px; color: #5b21b6; font-weight: 600; flex-wrap: wrap; }
        .cal-summary-arrow { color: #a855f7; font-size: 16px; }
        .cal-half-row { display: flex; gap: 24px; margin-top: 14px; flex-wrap: wrap; }
        .cal-hint { font-size: 12px; color: #9ca3af; margin-top: 10px; }
        @media (max-width: 600px) { .pto-form-page { padding: 18px 16px; } .reason-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); } .cal-months { gap: 20px; } }
      `}</style>

      <div className="pto-form-page">
        <div className="pto-form-inner">
          <div className="pto-form-title">{existing ? 'Edit PTO Request' : 'Request Time Off'}</div>

          <form onSubmit={handleSubmit}>
            {/* Date Range Picker */}
            <div className="form-section">
              <div className="form-section-title">Select Dates</div>

              <div className="cal-nav">
                <button type="button" className="cal-nav-btn" onClick={handlePrev}>‹</button>
                <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>
                  {MONTHS[calMonth]} {calYear} – {MONTHS[rightMonth]} {rightYear}
                </span>
                <button type="button" className="cal-nav-btn" onClick={handleNext}>›</button>
              </div>

              <div
                className="cal-months"
                onMouseLeave={() => setHoverDate('')}
              >
                <CalendarMonth
                  year={calYear} month={calMonth}
                  startDate={startDate} endDate={endDate} hoverDate={hoverDate}
                  onDayClick={handleDayClick}
                  onDayHover={setHoverDate}
                />
                <CalendarMonth
                  year={rightYear} month={rightMonth}
                  startDate={startDate} endDate={endDate} hoverDate={hoverDate}
                  onDayClick={handleDayClick}
                  onDayHover={setHoverDate}
                />
              </div>

              {startDate && endDate ? (
                <div className="cal-summary">
                  <span>{friendlyDate(startDate)}</span>
                  <span className="cal-summary-arrow">→</span>
                  <span>{friendlyDate(endDate)}</span>
                  <span style={{ marginLeft: 'auto', background: '#6b1e98', color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 12 }}>
                    {dayCountLabel}
                  </span>
                </div>
              ) : (
                <div className="cal-hint">
                  {!startDate ? 'Click a start date' : 'Now click an end date'}
                </div>
              )}

              {(startDate || endDate) && (
                <div className="cal-half-row">
                  {startDate && (
                    <label className="form-checkbox-row" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={startHalf} onChange={e => setStartHalf(e.target.checked)} />
                      Half day on {friendlyDate(startDate)}
                    </label>
                  )}
                  {endDate && endDate !== startDate && (
                    <label className="form-checkbox-row" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={endHalf} onChange={e => setEndHalf(e.target.checked)} />
                      Half day on {friendlyDate(endDate)}
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Reason */}
            <div className="form-section">
              <div className="form-section-title">Request Details</div>
              <div className="form-group">
                <label className="form-label">Request Type *</label>
                <div className="reason-grid">
                  {REASON_TILES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      className={`reason-tile${reason === t.value ? ' selected' : ''}`}
                      onClick={() => setReason(t.value)}
                    >
                      <span className="reason-icon">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Additional Notes</label>
                <textarea
                  className="form-textarea"
                  placeholder="Optional details about your request…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Signature */}
            <div className="form-section">
              <div className="form-section-title">Acknowledgment</div>
              <div className="signature-box">
                <p className="signature-agreement">
                  By typing my name below, I confirm that the information provided in this request
                  is accurate and that I have reviewed the applicable leave policies. I understand
                  this request is subject to manager and HR approval.
                </p>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Type your full name to confirm *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={user?.display_name ?? 'Your full name'}
                    value={signedName}
                    onChange={e => setSignedName(e.target.value)}
                    autoComplete="off"
                    required
                  />
                  <div className="signature-date">Date: {today()}</div>
                </div>
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            <div className="form-actions">
              <button type="submit" className="btn-submit" disabled={saving || signedName.trim() !== (user?.display_name ?? '')}>
                {saving ? 'Submitting…' : existing ? 'Resubmit Request' : 'Submit Request'}
              </button>
              <a href="/hr/pto" className="btn-cancel">Cancel</a>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
