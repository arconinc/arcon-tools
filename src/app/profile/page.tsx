'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAppUser } from '@/components/layout/AppShell'
import { TiptapEditor } from '@/components/news/TiptapEditor'
import TagInput from '@/components/employees/TagInput'
import EmployeeAvatar from '@/components/employees/EmployeeAvatar'
import { formatPhoneInput } from '@/lib/phone'

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

export default function MyProfilePage() {
  const { user: sessionUser } = useAppUser()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState<string | null>(null)

  // Editable fields
  const [phone, setPhone] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [timezone, setTimezone] = useState('')
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [bioJson, setBioJson] = useState<Record<string, unknown>>(EMPTY_BIO)
  const [bioHtml, setBioHtml] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [interests, setInterests] = useState<string[]>([])

  // Read-only display fields
  const [jobTitle, setJobTitle] = useState('')
  const [team, setTeam] = useState('')
  const [officeLocation, setOfficeLocation] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isDirty = useRef(false)

  useEffect(() => {
    if (!sessionUser) return
    fetch(`/api/employees`)
      .then((r) => r.json())
      .then((data: Array<{ id: string; email: string; display_name: string; job_title: string | null; team: string | null; office_location: string | null }>) => {
        const me = data.find((e) => e.email === sessionUser.email)
        if (!me) return
        setEmployeeId(me.id)
        setJobTitle(me.job_title ?? '')
        setTeam(me.team ?? '')
        setOfficeLocation(me.office_location ?? '')
        return fetch(`/api/employees/${me.id}`)
      })
      .then((r) => r ? r.json() : null)
      .then((data) => {
        if (!data) return
        setPhone(data.phone ?? '')
        setLinkedinUrl(data.linkedin_url ?? '')
        setTimezone(data.timezone ?? '')
        setProfileImageUrl(data.profile_image_url ?? '')
        setBioJson(data.bio_json ?? EMPTY_BIO)
        setBioHtml(data.bio_html ?? '')
        setSkills(data.skills ?? [])
        setInterests(data.interests ?? [])
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [sessionUser])

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true)
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/profile/upload-photo', { method: 'POST', body: fd })
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

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone || null,
        linkedin_url: linkedinUrl || null,
        timezone: timezone || null,
        profile_image_url: profileImageUrl || null,
        bio_json: bioJson,
        bio_html: bioHtml,
        skills,
        interests,
      }),
    })

    setSaving(false)
    if (res.ok) {
      setSuccess('Profile saved')
      setTimeout(() => setSuccess(null), 3000)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Save failed')
    }
  }

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
  }

  return (
    <>
      <style>{`
        .my-prof { max-width: 720px; margin: 0 auto; padding: 2rem; }
        .my-prof-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.75rem; gap: 1rem; flex-wrap: wrap; }
        .my-prof-title { font-size: 1.25rem; font-weight: 700; color: #1e293b; }
        .my-prof-view-link { font-size: 0.875rem; color: #7c3aed; text-decoration: none; }
        .my-prof-view-link:hover { text-decoration: underline; }
        .my-prof-save-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.625rem 1.5rem; background: #7c3aed; color: white; border: none; border-radius: 0.5rem; font-size: 0.9375rem; font-weight: 600; cursor: pointer; }
        .my-prof-save-btn:hover:not(:disabled) { background: #6d28d9; }
        .my-prof-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .my-prof-section { background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1.25rem; }
        .my-prof-section-title { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 1rem; }
        .my-prof-field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .my-prof-label { display: block; font-size: 0.8125rem; font-weight: 600; color: #374151; margin-bottom: 0.375rem; }
        .my-prof-input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 0.9375rem; outline: none; color: #1e293b; background: white; }
        .my-prof-input:focus { border-color: #a855f7; }
        .my-prof-select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 0.9375rem; outline: none; color: #1e293b; background: white; }
        .my-prof-select:focus { border-color: #a855f7; }
        .my-prof-readonly { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #f1f5f9; border-radius: 0.5rem; font-size: 0.9375rem; color: #64748b; background: #f8fafc; }
        .my-prof-readonly-note { font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem; }
        .my-prof-photo-row { display: flex; align-items: center; gap: 1rem; }
        .my-prof-upload-btn { padding: 0.5rem 1rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font-size: 0.875rem; color: #374151; background: white; cursor: pointer; }
        .my-prof-upload-btn:hover { border-color: #a855f7; color: #7c3aed; }
        .my-prof-hint { font-size: 0.8125rem; color: #94a3b8; }
        .my-prof-alert { padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.875rem; margin-bottom: 1rem; }
        .my-prof-alert-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .my-prof-alert-success { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
      `}</style>

      <div className="my-prof">
        <div className="my-prof-header">
          <div>
            <div className="my-prof-title">My Profile</div>
            {employeeId && (
              <Link href={`/employees/${employeeId}`} className="my-prof-view-link">
                View public profile ↗
              </Link>
            )}
          </div>
          <button className="my-prof-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {error && <div className="my-prof-alert my-prof-alert-error">{error}</div>}
        {success && <div className="my-prof-alert my-prof-alert-success">{success}</div>}

        {/* Read-only: admin-managed fields */}
        <div className="my-prof-section">
          <div className="my-prof-section-title">Role &amp; Location (managed by admin)</div>
          <div className="my-prof-field-grid">
            <div>
              <label className="my-prof-label">Job Title</label>
              <div className="my-prof-readonly">{jobTitle || '—'}</div>
            </div>
            <div>
              <label className="my-prof-label">Team</label>
              <div className="my-prof-readonly">{team || '—'}</div>
            </div>
            <div>
              <label className="my-prof-label">Office Location</label>
              <div className="my-prof-readonly">{officeLocation || '—'}</div>
            </div>
          </div>
          <p className="my-prof-readonly-note" style={{ marginTop: '0.75rem' }}>Contact an admin to update these fields.</p>
        </div>

        {/* Profile Photo */}
        <div className="my-prof-section">
          <div className="my-prof-section-title">Profile Photo</div>
          <div className="my-prof-photo-row">
            <EmployeeAvatar
              displayName={sessionUser?.display_name ?? ''}
              profileImageUrl={profileImageUrl}
              avatarUrl={sessionUser?.avatar_url}
              size="lg"
            />
            <div>
              <button
                className="my-prof-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? 'Uploading…' : 'Upload Photo'}
              </button>
              <p className="my-prof-hint" style={{ marginTop: '0.375rem' }}>JPEG or PNG, max 5MB</p>
              {profileImageUrl && (
                <button
                  className="my-prof-hint"
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

        {/* Contact */}
        <div className="my-prof-section">
          <div className="my-prof-section-title">Contact</div>
          <div className="my-prof-field-grid">
            <div>
              <label className="my-prof-label">Phone</label>
              <input
                className="my-prof-input"
                placeholder="(555) 555-5555"
                value={phone}
                onChange={(e) => { setPhone(formatPhoneInput(e.target.value)); isDirty.current = true }}
              />
            </div>
            <div>
              <label className="my-prof-label">LinkedIn URL</label>
              <input
                className="my-prof-input"
                placeholder="https://linkedin.com/in/…"
                value={linkedinUrl}
                onChange={(e) => { setLinkedinUrl(e.target.value); isDirty.current = true }}
              />
            </div>
            <div>
              <label className="my-prof-label">Timezone</label>
              <select
                className="my-prof-select"
                value={timezone}
                onChange={(e) => { setTimezone(e.target.value); isDirty.current = true }}
              >
                <option value="">— Select —</option>
                {US_TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* About Me */}
        <div className="my-prof-section">
          <div className="my-prof-section-title">About Me</div>
          <TiptapEditor
            content={bioJson}
            onChange={(json, html) => { setBioJson(json); setBioHtml(html); isDirty.current = true }}
            placeholder="Tell your colleagues a bit about yourself…"
            minHeight="180px"
          />
        </div>

        {/* Skills */}
        <div className="my-prof-section">
          <div className="my-prof-section-title">Skills &amp; Expertise</div>
          <TagInput
            tags={skills}
            onChange={(t) => { setSkills(t); isDirty.current = true }}
            placeholder="Add a skill and press Enter…"
          />
          <p className="my-prof-hint" style={{ marginTop: '0.5rem' }}>Press Enter or comma to add each skill</p>
        </div>

        {/* Interests */}
        <div className="my-prof-section">
          <div className="my-prof-section-title">Interests &amp; Hobbies</div>
          <TagInput
            tags={interests}
            onChange={(t) => { setInterests(t); isDirty.current = true }}
            placeholder="Add an interest and press Enter…"
          />
          <p className="my-prof-hint" style={{ marginTop: '0.5rem' }}>Press Enter or comma to add</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '2rem' }}>
          <button className="my-prof-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}
