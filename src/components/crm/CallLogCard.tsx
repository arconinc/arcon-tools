'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui'
import { formatDateTime } from '@/lib/format'
import { useCallLogs, type CallLogActivityType, type CallLogContact, type CallLogEntityType } from '@/hooks/useCallLogs'

type ContactOption = CallLogContact & {
  customer_id?: string | null
  vendor_id?: string | null
}

type Props = {
  entityType: CallLogEntityType
  entityId: string
  contactCustomerId?: string | null
}

type ContactForm = {
  first_name: string
  last_name: string
  email: string
  phone: string
  title: string
}

type LogForm = {
  contact_id: string
  activity_type: CallLogActivityType
  occurred_at: string
  duration_minutes: string
  outcome: string
  notes: string
  next_steps: string
}

const EMPTY_CONTACT: ContactForm = { first_name: '', last_name: '', email: '', phone: '', title: '' }
const OUTCOME_OPTIONS = ['Reached', 'Left voicemail', 'No answer', 'Follow-up needed', 'Sent information', 'Resolved']

function toDateTimeLocal(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60 * 1000
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16)
}

function formatContactName(contact: Pick<CallLogContact, 'first_name' | 'last_name'>) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim()
}

function activityLabel(type: CallLogActivityType) {
  if (type === 'text') return 'Text'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function contactQuery(entityType: CallLogEntityType, entityId: string, contactCustomerId?: string | null) {
  if (entityType === 'vendor') return `vendor_id=${encodeURIComponent(entityId)}`
  if (entityType === 'customer') return `customer_id=${encodeURIComponent(entityId)}`
  if (contactCustomerId) return `customer_id=${encodeURIComponent(contactCustomerId)}`
  return ''
}

function contactCreateParent(entityType: CallLogEntityType, entityId: string, contactCustomerId?: string | null) {
  if (entityType === 'vendor') return { vendor_id: entityId, type_of_contact: 'Vendor' }
  if (entityType === 'customer') return { customer_id: entityId, type_of_contact: 'Customer' }
  if (contactCustomerId) return { customer_id: contactCustomerId, type_of_contact: 'Customer' }
  return null
}

export function CallLogCard({ entityType, entityId, contactCustomerId }: Props) {
  const { callLogs, loading, error, createCallLog } = useCallLogs(entityType, entityId)
  const [open, setOpen] = useState(false)
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [showNewContact, setShowNewContact] = useState(false)
  const [contactForm, setContactForm] = useState<ContactForm>(EMPTY_CONTACT)
  const [form, setForm] = useState<LogForm>({
    contact_id: '',
    activity_type: 'call',
    occurred_at: toDateTimeLocal(new Date()),
    duration_minutes: '',
    outcome: '',
    notes: '',
    next_steps: '',
  })

  const query = useMemo(() => contactQuery(entityType, entityId, contactCustomerId), [entityType, entityId, contactCustomerId])
  const canAddContact = !!contactCreateParent(entityType, entityId, contactCustomerId)

  useEffect(() => {
    if (!query) return
    setContactsLoading(true)
    fetch(`/api/marketing/contacts?${query}&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.contacts)) setContacts(data.contacts)
      })
      .catch(() => {})
      .finally(() => setContactsLoading(false))
  }, [query])

  function resetForm() {
    setForm({
      contact_id: '',
      activity_type: 'call',
      occurred_at: toDateTimeLocal(new Date()),
      duration_minutes: '',
      outcome: '',
      notes: '',
      next_steps: '',
    })
    setContactForm(EMPTY_CONTACT)
    setShowNewContact(false)
    setFormError(null)
  }

  function closeModal() {
    resetForm()
    setOpen(false)
  }

  function updateForm(field: keyof LogForm, value: string) {
    setFormError(null)
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function createContactIfNeeded() {
    if (!showNewContact) return form.contact_id || null
    const parent = contactCreateParent(entityType, entityId, contactCustomerId)
    if (!parent) throw new Error('Contacts cannot be added for this record yet')
    if (!contactForm.first_name.trim() || !contactForm.last_name.trim()) {
      throw new Error('First and last name are required for the new contact')
    }

    const res = await fetch('/api/marketing/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...parent,
        first_name: contactForm.first_name.trim(),
        last_name: contactForm.last_name.trim(),
        email: contactForm.email.trim() || null,
        phone: contactForm.phone.trim() || null,
        title: contactForm.title.trim() || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to add contact')
    setContacts((prev) => [...prev, data])
    return data.id as string
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.notes.trim() && !form.outcome.trim() && !form.next_steps.trim()) {
      setFormError('Add notes, an outcome, or next steps')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const contactId = await createContactIfNeeded()
      await createCallLog({
        contact_id: contactId,
        activity_type: form.activity_type,
        occurred_at: new Date(form.occurred_at).toISOString(),
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        outcome: form.outcome || null,
        notes: form.notes || null,
        next_steps: form.next_steps || null,
      })
      closeModal()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to log conversation')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white'
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5'

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5.5A2.5 2.5 0 015.5 3h2A1.5 1.5 0 019 4.5v2A1.5 1.5 0 017.5 8H7a9 9 0 009 9v-.5a1.5 1.5 0 011.5-1.5h2A1.5 1.5 0 0121 16.5v2A2.5 2.5 0 0118.5 21h-1C9.492 21 3 14.508 3 6.5v-1z" />
            </svg>
            <h2 className="text-sm font-semibold text-slate-700">Call Log</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-2.5 py-1 text-xs font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors"
          >
            + Log
          </button>
        </div>

        <div className="p-3">
          {loading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : callLogs.length === 0 ? (
            <div className="py-5 text-center text-sm text-slate-400">No conversations logged yet.</div>
          ) : (
            <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {callLogs.map((log) => {
                const contactName = log.contact_name_snapshot
                  ?? (log.contact ? formatContactName(log.contact) : null)
                  ?? 'No contact selected'
                return (
                  <div key={log.id} className="rounded-xl border border-slate-100 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">{contactName}</div>
                        <div className="text-xs text-slate-400">{formatDateTime(log.occurred_at)}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                        {activityLabel(log.activity_type)}
                      </span>
                    </div>
                    {(log.notes || log.outcome || log.next_steps) && (
                      <div className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600">
                        {log.outcome && <div><span className="font-semibold text-slate-500">Outcome:</span> {log.outcome}</div>}
                        {log.notes && <div className="line-clamp-3 whitespace-pre-wrap">{log.notes}</div>}
                        {log.next_steps && <div><span className="font-semibold text-slate-500">Next:</span> {log.next_steps}</div>}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      {log.duration_minutes != null && <span>{log.duration_minutes} min</span>}
                      <span>Logged by {log.logged_by_user?.display_name ?? 'Unknown'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Modal open={open} onClose={closeModal} title="Log Conversation">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date &amp; Time</label>
              <input type="datetime-local" value={form.occurred_at} onChange={(e) => updateForm('occurred_at', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Duration</label>
              <input type="number" min="0" max="1440" placeholder="Minutes" value={form.duration_minutes} onChange={(e) => updateForm('duration_minutes', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type</label>
              <select value={form.activity_type} onChange={(e) => updateForm('activity_type', e.target.value as CallLogActivityType)} className={inputCls}>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="text">Text</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Outcome</label>
              <select value={form.outcome} onChange={(e) => updateForm('outcome', e.target.value)} className={inputCls}>
                <option value="">-</option>
                {OUTCOME_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
          </div>

          {!showNewContact ? (
            <div>
              <div className="mb-0.5 flex items-center justify-between gap-3">
                <label className={labelCls}>Who They Talked To</label>
                {canAddContact && (
                  <button type="button" onClick={() => setShowNewContact(true)} className="text-xs font-semibold text-purple-700 hover:text-purple-900">
                    + Add contact
                  </button>
                )}
              </div>
              <select value={form.contact_id} onChange={(e) => updateForm('contact_id', e.target.value)} className={inputCls}>
                <option value="">- No contact selected -</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {formatContactName(contact)}{contact.title ? `, ${contact.title}` : ''}
                  </option>
                ))}
              </select>
              {contactsLoading && <div className="mt-1 text-xs text-slate-400">Loading contacts...</div>}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">New Contact</div>
                <button type="button" onClick={() => setShowNewContact(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Use existing</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="First name" value={contactForm.first_name} onChange={(e) => setContactForm((p) => ({ ...p, first_name: e.target.value }))} className={inputCls} />
                <input placeholder="Last name" value={contactForm.last_name} onChange={(e) => setContactForm((p) => ({ ...p, last_name: e.target.value }))} className={inputCls} />
                <input type="email" placeholder="Email" value={contactForm.email} onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))} className={inputCls} />
                <input placeholder="Phone" value={contactForm.phone} onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))} className={inputCls} />
                <div className="col-span-2">
                  <input placeholder="Title" value={contactForm.title} onChange={(e) => setContactForm((p) => ({ ...p, title: e.target.value }))} className={inputCls} />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={4} value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} className={`${inputCls} resize-none`} />
          </div>

          <div>
            <label className={labelCls}>Next Steps</label>
            <input value={form.next_steps} onChange={(e) => updateForm('next_steps', e.target.value)} className={inputCls} />
          </div>

          {formError && <div className="text-xs text-red-600">{formError}</div>}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 py-2 text-sm font-semibold bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl transition-colors">
              {saving ? 'Logging...' : 'Log Conversation'}
            </button>
            <button type="button" onClick={closeModal} className="flex-1 py-2 text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
