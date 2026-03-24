'use client'

import { useState, useEffect, useRef, use } from 'react'
import Link from 'next/link'
import { TiptapEditor } from '@/components/news/TiptapEditor'
import TagInput from '@/components/employees/TagInput'
import EmployeeAvatar from '@/components/employees/EmployeeAvatar'
import { formatPhoneInput } from '@/lib/phone'
import type { OfficeLocation, EmploymentType, EmployeeTeam, EmployeeSummary } from '@/types'

const OFFICE_LOCATIONS: OfficeLocation[] = ['Remote', 'Minnesota', 'Arizona', 'Colorado']
const EMPLOYMENT_TYPES: EmploymentType[] = ['full-time', 'part-time', 'contractor']
const TEAMS: EmployeeTeam[] = ['Sales', 'Marketing', 'IT', 'Operations', 'Finance', 'HR']
const US_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
]

const EMPTY_BIO: Record<string, unknown> = {}

interface Props {
  params: Promise<{ id: string }>
}

export default function AdminEmployeeEditPage({ params }: Props) {
  const { id } = use(params)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [allEmployees, setAllEmployees] = useState<EmployeeSummary[]>([])

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [employmentType, setEmploymentType] = useState<EmploymentType | ''>('')
  const [team, setTeam] = useState<EmployeeTeam | ''>('')
  const [officeLocation, setOfficeLocation] = useState<OfficeLocation | ''>('')
  const [timezone, setTimezone] = useState('')
  const [managerId, setManagerId] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [phone, setPhone] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [bioJson, setBioJson] = useState<Record<string, unknown>>(EMPTY_BIO)
  const [bioHtml, setBioHtml] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [interests, setInterests] = useState<string[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isDirty = useRef(false)

  useEffect(() => {
    fetch(`/api/admin/employees/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setDisplayName(data.display_name ?? '')
        setJobTitle(data.job_title ?? '')
        setEmploymentType(data.employment_type ?? '')
        setTeam(data.team ?? '')
        setOfficeLocation(data.office_location ?? '')
        setTimezone(data.timezone ?? '')
        setManagerId(data.manager_id ?? '')
        setBirthDate(data.birth_date ?? '')
        setStartDate(data.start_date ?? '')
        setIsAdmin(data.is_admin ?? false)
        setPhone(data.phone ?? '')
        setLinkedinUrl(data.linkedin_url ?? '')
        setProfileImageUrl(data.profile_image_url ?? '')
        setBioJson(data.bio_json ?? EMPTY_BIO)
        setBioHtml(data.bio_html ?? '')
        setSkills(data.skills ?? [])
        setInterests(data.interests ?? [])
      })
      .catch(() => setError('Failed to load employee'))
      .finally(() => setLoading(false))

    fetch('/api/employees')
      .then((r) => r.json())
      .then((data: EmployeeSummary[]) => setAllEmployees(data.filter((e) => e.id !== id)))
      .catch(() => {})
  }, [id])

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true)
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('userId', id)
    const res = await fetch('/api/admin/employees/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploadingPhoto(false)
    if (!res.ok) { setError(data.error ?? 'Upload failed'); return }
    setProfileImageUrl(data.url)
    isDirty.current = true
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    isDirty.current = false

    const res = await fetch(`/api/admin/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName,
        job_title: jobTitle || null,
        employment_type: employmentType || null,
        team: team || null,
        office_location: officeLocation || null,
        timezone: timezone || null,
        manager_id: managerId || null,
        birth_date: birthDate || null,
        start_date: startDate || null,
        is_admin: isAdmin,
        phone: phone || null,
        linkedin_url: linkedinUrl || null,
        profile_image_url: profileImageUrl || null,
        bio_json: bioJson,
        bio_html: bioHtml,
        skills,
        interests,
      }),
    })

    setSaving(false)
    if (res.ok) {
      setSuccess('Saved successfully')
      setTimeout(() => setSuccess(null), 3000)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Save failed')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading employee…
      </div>
    )
  }

  return (
    <>
      <style>{`
        .emp-edit { max-width: 800px; margin: 0 auto; padding: 2rem; }
        .emp-edit-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
        .emp-edit-title { font-size: 1.25rem; font-weight: 700; color: #1e293b; }
        .emp-edit-subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.125rem; }
        .emp-back { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; color: #64748b; text-decoration: none; margin-bottom: 1.5rem; }
        .emp-back:hover { color: #7c3aed; }
        .emp-save-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.625rem 1.5rem; background: #7c3aed; color: white; border: none; border-radius: 0.5rem; font-size: 0.9375rem; font-weight: 600; cursor: pointer; }
        .emp-save-btn:hover:not(:disabled) { background: #6d28d9; }
        .emp-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .emp-section { background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1.25rem; }
        .emp-section-title { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 1rem; }
        .emp-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .emp-field { }
        .emp-field-full { grid-column: 1 / -1; }
        .emp-label { display: block; font-size: 0.8125rem; font-weight: 600; color: #374151; margin-bottom: 0.375rem; }
        .emp-input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 0.9375rem; outline: none; color: #1e293b; background: white; }
        .emp-input:focus { border-color: #a855f7; }
        .emp-select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 0.9375rem; outline: none; color: #1e293b; background: white; }
        .emp-select:focus { border-color: #a855f7; }
        .emp-toggle-row { display: flex; align-items: center; gap: 0.75rem; }
        .emp-toggle { position: relative; display: inline-block; width: 44px; height: 24px; }
        .emp-toggle input { opacity: 0; width: 0; height: 0; }
        .emp-slider { position: absolute; inset: 0; background: #e2e8f0; border-radius: 9999px; cursor: pointer; transition: 0.2s; }
        .emp-slider:before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.2s; }
        input:checked + .emp-slider { background: #7c3aed; }
        input:checked + .emp-slider:before { transform: translateX(20px); }
        .emp-photo-row { display: flex; align-items: center; gap: 1rem; }
        .emp-photo-upload-btn { padding: 0.5rem 1rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 0.875rem; color: #374151; background: white; cursor: pointer; }
        .emp-photo-upload-btn:hover { border-color: #a855f7; color: #7c3aed; }
        .emp-photo-hint { font-size: 0.8125rem; color: #94a3b8; }
        .emp-alert { padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.875rem; margin-bottom: 1rem; }
        .emp-alert-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .emp-alert-success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
        .emp-view-link { font-size: 0.875rem; color: #7c3aed; text-decoration: none; }
        .emp-view-link:hover { text-decoration: underline; }
      `}</style>

      <div className="emp-edit">
        <Link href={`/employees/${id}`} className="emp-back">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          View Profile
        </Link>

        <div className="emp-edit-header">
          <div>
            <div className="emp-edit-title">Edit Employee</div>
            <div className="emp-edit-subtitle">{displayName}</div>
          </div>
          <button className="emp-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {error && <div className="emp-alert emp-alert-error">{error}</div>}
        {success && <div className="emp-alert emp-alert-success">{success}</div>}

        {/* Section 1: Identity */}
        <div className="emp-section">
          <div className="emp-section-title">Identity</div>
          <div className="emp-field-grid">
            <div className="emp-field">
              <label className="emp-label">Display Name</label>
              <input className="emp-input" value={displayName} onChange={(e) => { setDisplayName(e.target.value); isDirty.current = true }} />
            </div>
            <div className="emp-field">
              <label className="emp-label">Job Title</label>
              <input className="emp-input" placeholder="e.g. Senior Account Manager" value={jobTitle} onChange={(e) => { setJobTitle(e.target.value); isDirty.current = true }} />
            </div>
            <div className="emp-field">
              <label className="emp-label">Employment Type</label>
              <select className="emp-select" value={employmentType} onChange={(e) => { setEmploymentType(e.target.value as EmploymentType | ''); isDirty.current = true }}>
                <option value="">— Select —</option>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t} style={{ textTransform: 'capitalize' }}>{t}</option>
                ))}
              </select>
            </div>
            <div className="emp-field emp-toggle-row" style={{ paddingTop: '1.5rem' }}>
              <label className="emp-toggle">
                <input type="checkbox" checked={isAdmin} onChange={(e) => { setIsAdmin(e.target.checked); isDirty.current = true }} />
                <span className="emp-slider" />
              </label>
              <span style={{ fontSize: '0.9375rem', color: '#374151' }}>Admin Access</span>
            </div>
          </div>
        </div>

        {/* Section 2: Team & Location */}
        <div className="emp-section">
          <div className="emp-section-title">Team &amp; Location</div>
          <div className="emp-field-grid">
            <div className="emp-field">
              <label className="emp-label">Team</label>
              <select className="emp-select" value={team} onChange={(e) => { setTeam(e.target.value as EmployeeTeam | ''); isDirty.current = true }}>
                <option value="">— Select —</option>
                {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="emp-field">
              <label className="emp-label">Office Location</label>
              <select className="emp-select" value={officeLocation} onChange={(e) => { setOfficeLocation(e.target.value as OfficeLocation | ''); isDirty.current = true }}>
                <option value="">— Select —</option>
                {OFFICE_LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="emp-field">
              <label className="emp-label">Timezone</label>
              <select className="emp-select" value={timezone} onChange={(e) => { setTimezone(e.target.value); isDirty.current = true }}>
                <option value="">— Select —</option>
                {US_TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div className="emp-field">
              <label className="emp-label">Reports To</label>
              <select className="emp-select" value={managerId} onChange={(e) => { setManagerId(e.target.value); isDirty.current = true }}>
                <option value="">— No manager —</option>
                {allEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.display_name}{e.job_title ? ` — ${e.job_title}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: HR Details */}
        <div className="emp-section">
          <div className="emp-section-title">HR Details</div>
          <div className="emp-field-grid">
            <div className="emp-field">
              <label className="emp-label">Birthday (MM-DD)</label>
              <input className="emp-input" placeholder="e.g. 03-15" maxLength={5} value={birthDate} onChange={(e) => { setBirthDate(e.target.value); isDirty.current = true }} />
            </div>
            <div className="emp-field">
              <label className="emp-label">Start Date</label>
              <input className="emp-input" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); isDirty.current = true }} />
            </div>
          </div>
        </div>

        {/* Section 4: Contact */}
        <div className="emp-section">
          <div className="emp-section-title">Contact</div>
          <div className="emp-field-grid">
            <div className="emp-field">
              <label className="emp-label">Phone</label>
              <input
                className="emp-input"
                placeholder="(555) 555-5555"
                value={phone}
                onChange={(e) => { setPhone(formatPhoneInput(e.target.value)); isDirty.current = true }}
              />
            </div>
            <div className="emp-field">
              <label className="emp-label">LinkedIn URL</label>
              <input
                className="emp-input"
                placeholder="https://linkedin.com/in/…"
                value={linkedinUrl}
                onChange={(e) => { setLinkedinUrl(e.target.value); isDirty.current = true }}
              />
            </div>
          </div>
        </div>

        {/* Section 5: Profile Photo */}
        <div className="emp-section">
          <div className="emp-section-title">Profile Photo</div>
          <div className="emp-photo-row">
            <EmployeeAvatar
              displayName={displayName}
              profileImageUrl={profileImageUrl}
              size="lg"
            />
            <div>
              <button
                className="emp-photo-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? 'Uploading…' : 'Upload Photo'}
              </button>
              <p className="emp-photo-hint" style={{ marginTop: '0.375rem' }}>
                JPEG or PNG, max 5MB. Replaces Google profile photo.
              </p>
              {profileImageUrl && (
                <button
                  className="emp-photo-hint"
                  style={{ marginTop: '0.25rem', color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                  onClick={() => { setProfileImageUrl(''); isDirty.current = true }}
                >
                  Remove custom photo
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handlePhotoUpload(file)
              e.target.value = ''
            }}
          />
        </div>

        {/* Section 6: About Me */}
        <div className="emp-section">
          <div className="emp-section-title">About Me</div>
          <TiptapEditor
            content={bioJson}
            onChange={(json, html) => { setBioJson(json); setBioHtml(html); isDirty.current = true }}
            placeholder="Write a short bio…"
            minHeight="180px"
          />
        </div>

        {/* Section 7: Skills */}
        <div className="emp-section">
          <div className="emp-section-title">Skills &amp; Expertise</div>
          <TagInput
            tags={skills}
            onChange={(t) => { setSkills(t); isDirty.current = true }}
            placeholder="Add a skill and press Enter…"
          />
          <p style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '0.5rem' }}>Press Enter or comma to add each skill</p>
        </div>

        {/* Section 8: Interests */}
        <div className="emp-section">
          <div className="emp-section-title">Interests &amp; Hobbies</div>
          <TagInput
            tags={interests}
            onChange={(t) => { setInterests(t); isDirty.current = true }}
            placeholder="Add an interest and press Enter…"
          />
          <p style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '0.5rem' }}>Press Enter or comma to add each interest</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '2rem' }}>
          <button className="emp-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}
