'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppUser } from '@/components/layout/AppShell'
import { PtoRequest, PTO_REASON_LABELS, PtoReason } from '@/types'

interface Props {
  existing?: PtoRequest
}

const REASONS = Object.entries(PTO_REASON_LABELS) as [PtoReason, string][]

function today() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function PtoRequestForm({ existing }: Props) {
  const router = useRouter()
  const { user } = useAppUser()
  const [startDate, setStartDate] = useState(existing?.start_date ?? '')
  const [endDate, setEndDate] = useState(existing?.end_date ?? '')
  const [startHalf, setStartHalf] = useState(existing?.start_half_day ?? false)
  const [endHalf, setEndHalf] = useState(existing?.end_half_day ?? false)
  const [reason, setReason] = useState<PtoReason | ''>(existing?.reason ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [signedName, setSignedName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!startDate || !endDate || !reason || !signedName.trim()) {
      setError('Please fill in all required fields and type your name to confirm.')
      return
    }
    if (startDate > endDate) {
      setError('End date must be on or after start date.')
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
      if (!res.ok) {
        setError(data.error ?? 'Submission failed')
        return
      }
      router.push('/hr/pto')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <style>{`
        .pto-form-page { padding: 28px 32px; max-width: 640px; }
        .pto-form-title { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 24px; }
        .form-section { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px 22px; margin-bottom: 16px; }
        .form-section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: #888; margin-bottom: 14px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        .form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
        .form-group:last-child { margin-bottom: 0; }
        .form-label { font-size: 12px; font-weight: 700; color: #444; }
        .form-input, .form-select, .form-textarea { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 10px; font-size: 13px; color: #111; background: #fff; width: 100%; box-sizing: border-box; }
        .form-input:focus, .form-select:focus, .form-textarea:focus { outline: 2px solid #6b1e98; border-color: #6b1e98; }
        .form-textarea { resize: vertical; min-height: 80px; }
        .form-checkbox-row { display: flex; align-items: center; gap: 7px; margin-top: 6px; }
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
        @media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } .pto-form-page { padding: 18px 16px; } }
      `}</style>

      <div className="pto-form-page">
        <div className="pto-form-title">{existing ? 'Edit PTO Request' : 'Request Time Off'}</div>

        <form onSubmit={handleSubmit}>
          {/* Dates */}
          <div className="form-section">
            <div className="form-section-title">Dates</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={e => {
                    setStartDate(e.target.value)
                    if (endDate && e.target.value > endDate) setEndDate(e.target.value)
                  }}
                  required
                />
                <div className="form-checkbox-row">
                  <input
                    type="checkbox"
                    id="start-half"
                    checked={startHalf}
                    onChange={e => setStartHalf(e.target.checked)}
                  />
                  <label htmlFor="start-half">Half day</label>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">End Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  required
                />
                <div className="form-checkbox-row">
                  <input
                    type="checkbox"
                    id="end-half"
                    checked={endHalf}
                    onChange={e => setEndHalf(e.target.checked)}
                  />
                  <label htmlFor="end-half">Half day</label>
                </div>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="form-section">
            <div className="form-section-title">Request Details</div>
            <div className="form-group">
              <label className="form-label">Reason *</label>
              <select
                className="form-select"
                value={reason}
                onChange={e => setReason(e.target.value as PtoReason)}
                required
              >
                <option value="" disabled>Select a reason…</option>
                {REASONS.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
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
    </>
  )
}
