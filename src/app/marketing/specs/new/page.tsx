'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { SpecIdea } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomerResult = {
  id: string
  name: string
  client_status: string | null
  logo_url: string | null
  billing_city: string | null
  billing_state: string | null
  last_spec_sent?: string | null
}

type ContactResult = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
}

type UserOption = { id: string; display_name: string }

type SelectedItem = {
  idea?: SpecIdea
  item_name: string
  item_number: string
  vendor: string
  vendor_link: string
  po_number: string
  order_date: string
  date_sent: string
  notes: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function futureDate(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const styles: Record<string, string> = {
    Active: 'bg-green-100 text-green-700',
    Prospective: 'bg-slate-100 text-slate-600',
    Former: 'bg-red-100 text-red-700',
  }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: status === 'Active' ? '#dcfce7' : status === 'Former' ? '#fee2e2' : '#f1f5f9', color: status === 'Active' ? '#15803d' : status === 'Former' ? '#b91c1c' : '#64748b' }}>
      {status}
    </span>
  )
}

// ─── Step indicators ──────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: 'Customer', sub: 'Find or create' },
  { n: 2, label: 'Items', sub: 'Choose products' },
  { n: 3, label: 'Details', sub: 'Spec & quantities' },
  { n: 4, label: 'Follow-up', sub: 'Dates & notes' },
  { n: 5, label: 'Review', sub: 'Confirm & send' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NewSpecWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preloadIdeaId = searchParams.get('ideaId')
  const preloadCustomerId = searchParams.get('customerId')

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [createdIds, setCreatedIds] = useState<string[]>([])

  // Step 1
  const [custSearch, setCustSearch] = useState('')
  const [custResults, setCustResults] = useState<CustomerResult[]>([])
  const [custLoading, setCustLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null)
  const [customerContacts, setCustomerContacts] = useState<ContactResult[]>([])
  const [selectedContact, setSelectedContact] = useState<ContactResult | null>(null)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustFirstName, setNewCustFirstName] = useState('')
  const [newCustLastName, setNewCustLastName] = useState('')
  const [newCustEmail, setNewCustEmail] = useState('')
  const [newCustPhone, setNewCustPhone] = useState('')
  const [newCustCity, setNewCustCity] = useState('')
  const [newCustState, setNewCustState] = useState('')
  const [savingCust, setSavingCust] = useState(false)

  // Step 2
  const [ideaSearch, setIdeaSearch] = useState('')
  const [ideas, setIdeas] = useState<SpecIdea[]>([])
  const [suggestions, setSuggestions] = useState<SpecIdea[]>([])
  const [ideasLoading, setIdeasLoading] = useState(false)
  const [itemTab, setItemTab] = useState<'ideas' | 'custom'>('ideas')
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])
  const [customItem, setCustomItem] = useState({ item_name: '', item_number: '', vendor_link: '' })

  // Step 3 — per-item details (index matches selectedItems)
  // Using a map per item index
  const [itemDetails, setItemDetails] = useState<Record<number, Partial<SelectedItem>>>({})

  // Step 4
  const [followUpDate, setFollowUpDate] = useState(futureDate(14))
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [createTask, setCreateTask] = useState(true)
  const [users, setUsers] = useState<UserOption[]>([])
  const [salesRepId, setSalesRepId] = useState('')
  const [assignedCsrId, setAssignedCsrId] = useState('')

  // ── Pre-load customer and idea from URL params ──────────────────────────────
  useEffect(() => {
    if (preloadCustomerId) {
      fetch(`/api/marketing/customers/${preloadCustomerId}`).then(r => r.json()).then(d => {
        if (d?.id) {
          setSelectedCustomer(d)
          setStep(2)
        }
      })
    }
  }, [preloadCustomerId])

  useEffect(() => {
    if (preloadIdeaId) {
      fetch(`/api/marketing/spec-ideas/${preloadIdeaId}`).then(r => r.json()).then((idea: SpecIdea) => {
        if (idea?.id) {
          setSelectedItems([{
            idea,
            item_name: idea.item_name,
            item_number: idea.item_number ?? '',
            vendor: idea.vendor,
            vendor_link: idea.vendor_url ?? '',
            po_number: '',
            order_date: todayStr(),
            date_sent: '',
            notes: '',
          }])
        }
      })
    }
  }, [preloadIdeaId])

  // ── Fetch users ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/marketing/users').then(r => r.json()).then((d: UserOption[]) => {
      if (Array.isArray(d)) setUsers(d)
    })
  }, [])

  // ── Customer search ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!custSearch.trim()) { setCustResults([]); return }
    setCustLoading(true)
    const t = setTimeout(async () => {
      const res = await fetch(`/api/marketing/customers?search=${encodeURIComponent(custSearch)}&limit=10`)
      const data = await res.json()
      setCustResults(Array.isArray(data.customers) ? data.customers : [])
      setCustLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [custSearch])

  // ── Load contacts when customer selected ──────────────────────────────────
  useEffect(() => {
    if (!selectedCustomer) { setCustomerContacts([]); return }
    fetch(`/api/marketing/customers/${selectedCustomer.id}`).then(r => r.json()).then((d: any) => {
      setCustomerContacts(Array.isArray(d.contacts) ? d.contacts : [])
    })
  }, [selectedCustomer])

  // ── Spec ideas search ─────────────────────────────────────────────────────
  const fetchIdeas = useCallback(async () => {
    setIdeasLoading(true)
    const params = new URLSearchParams()
    if (ideaSearch) params.set('q', ideaSearch)
    const data = await fetch(`/api/marketing/spec-ideas?${params}`).then(r => r.json())
    setIdeas(Array.isArray(data) ? data : [])
    setIdeasLoading(false)
  }, [ideaSearch])

  useEffect(() => {
    const t = setTimeout(() => fetchIdeas(), 250)
    return () => clearTimeout(t)
  }, [fetchIdeas])

  // ── Fetch suggestions when customer selected ───────────────────────────────
  useEffect(() => {
    if (!selectedCustomer) { setSuggestions([]); return }
    fetch(`/api/marketing/spec-ideas/suggest?customerId=${selectedCustomer.id}&limit=6`)
      .then(r => r.json())
      .then((d: SpecIdea[]) => setSuggestions(Array.isArray(d) ? d : []))
  }, [selectedCustomer])

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSaveNewCustomer() {
    if (!newCustName.trim()) return
    setSavingCust(true)
    const res = await fetch('/api/marketing/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newCustName,
        client_status: 'Prospective',
        billing_city: newCustCity || null,
        billing_state: newCustState || null,
      }),
    })
    const customer = await res.json()
    // Create contact if name provided
    if (newCustFirstName.trim() || newCustLastName.trim()) {
      await fetch('/api/marketing/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: newCustFirstName,
          last_name: newCustLastName,
          email: newCustEmail || null,
          phone: newCustPhone || null,
          customer_id: customer.id,
          type_of_contact: 'Customer',
        }),
      })
    }
    setSelectedCustomer(customer)
    setShowNewCustomer(false)
    setSavingCust(false)
  }

  function handleSelectIdea(idea: SpecIdea) {
    const already = selectedItems.find(i => i.idea?.id === idea.id)
    if (already) {
      setSelectedItems(prev => prev.filter(i => i.idea?.id !== idea.id))
      return
    }
    setSelectedItems(prev => [...prev, {
      idea,
      item_name: idea.item_name,
      item_number: idea.item_number ?? '',
      vendor: idea.vendor,
      vendor_link: idea.vendor_url ?? '',
      po_number: '',
      order_date: todayStr(),
      date_sent: '',
      notes: '',
    }])
  }

  function handleAddCustomItem() {
    if (!customItem.item_name.trim()) return
    setSelectedItems(prev => [...prev, {
      item_name: customItem.item_name,
      item_number: '',
      vendor: '',
      vendor_link: customItem.vendor_link,
      po_number: '',
      order_date: todayStr(),
      date_sent: '',
      notes: '',
    }])
    setCustomItem({ item_name: '', item_number: '', vendor_link: '' })
    setItemTab('ideas')
  }

  function updateItemDetail(idx: number, field: string, value: string) {
    setItemDetails(prev => ({ ...prev, [idx]: { ...prev[idx], [field]: value } }))
  }

  async function handleSubmit() {
    if (!selectedCustomer || selectedItems.length === 0) return
    setSaving(true)

    const specs = selectedItems.map((item, idx) => ({
      customer_id: selectedCustomer.id,
      contact_id: selectedContact?.id ?? null,
      sales_rep_id: salesRepId || null,
      assigned_csr_id: assignedCsrId || null,
      spec_idea_id: item.idea?.id ?? null,
      item_name: itemDetails[idx]?.item_name ?? item.item_name,
      item_number: itemDetails[idx]?.item_number ?? item.item_number ?? null,
      item_image_url: item.idea?.image_url ?? null,
      vendor: item.idea?.vendor ?? null,
      vendor_link: itemDetails[idx]?.vendor_link ?? item.vendor_link ?? null,
      po_number: itemDetails[idx]?.po_number ?? item.po_number ?? null,
      order_date: itemDetails[idx]?.order_date ?? item.order_date ?? todayStr(),
      date_sent: itemDetails[idx]?.date_sent ?? item.date_sent ?? null,
      notes: itemDetails[idx]?.notes ?? item.notes ?? null,
      status: 'not_contacted',
      follow_up_date: followUpDate || null,
      follow_up_notes: followUpNotes || null,
    }))

    const res = await fetch('/api/marketing/specs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specs, create_task: createTask }),
    })

    const created = await res.json()
    setSaving(false)
    if (res.ok && Array.isArray(created)) {
      setCreatedIds(created.map((s: any) => s.id))
      setStep(6) // success screen
    }
  }

  // ─── Render helpers ───────────────────────────────────────────────────────

  const totalEstimate = selectedItems.reduce((sum, item) => {
    const range = item.idea?.price_range
    if (!range) return sum
    const m = range.match(/\$([\d.]+)[–-]\$([\d.]+)/)
    if (m) return sum + (parseFloat(m[1]) + parseFloat(m[2])) / 2
    return sum
  }, 0)

  const fmtRange = (items: SelectedItem[]) => {
    let lo = 0, hi = 0, count = 0
    for (const item of items) {
      const range = item.idea?.price_range
      if (range) {
        const m = range.match(/\$([\d.]+)[–-]\$([\d.]+)/)
        if (m) { lo += parseFloat(m[1]); hi += parseFloat(m[2]); count++ }
      }
    }
    if (count === 0) return null
    return `$${lo.toFixed(2)} – $${hi.toFixed(2)}`
  }

  // ─── Step content ─────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      <style>{`
        .wizard-step-num { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; }
        .step-done { background: #7c3aed; color: white; }
        .step-active { background: #7c3aed; color: white; box-shadow: 0 0 0 4px #ede9fe; }
        .step-future { background: #f1f5f9; color: #94a3b8; }
        .wiz-input { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; font-size: 14px; color: #1e293b; width: 100%; outline: none; background: white; box-sizing: border-box; }
        .wiz-input:focus { border-color: #7c3aed; }
        .wiz-label { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 5px; display: block; }
        .idea-card { border: 2px solid #e2e8f0; border-radius: 10px; overflow: hidden; cursor: pointer; transition: border-color .12s; }
        .idea-card:hover { border-color: #7c3aed; }
        .idea-card-selected { border-color: #7c3aed; background: #faf9ff; }
        .check-overlay { position: absolute; top: 8px; right: 8px; background: #7c3aed; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }
        .basket-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
        .basket-item:last-child { border-bottom: none; }
        .btn-next { background: #7c3aed; color: white; border: none; border-radius: 9px; padding: '11px 24px'; font-size: 15px; font-weight: 700; cursor: pointer; }
        .btn-next:hover { background: #6d28d9; }
        .btn-next:disabled { opacity: .5; cursor: default; }
        .btn-back { background: white; color: #374151; border: 1px solid #e2e8f0; border-radius: 9px; padding: '10px 20px'; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-back:hover { background: #f8fafc; }
        .cust-result { padding: 12px 14px; cursor: pointer; border-radius: 8px; display: flex; gap: 12px; align-items: center; }
        .cust-result:hover { background: #f8fafc; }
        .cust-selected { background: #f3f0ff; border: 2px solid #7c3aed; border-radius: 12px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
        .form-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      `}</style>

      {/* Sidebar nav */}
      <div style={{ width: 240, background: 'white', borderRight: '1px solid #e2e8f0', padding: '32px 24px', flexShrink: 0 }}>
        <Link href="/marketing/specs" style={{ color: '#7c3aed', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28 }}>
          ← Back
        </Link>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>Create New Spec</h2>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 28px' }}>Build a spec sample for a customer</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {STEPS.map(s => (
            <div
              key={s.n}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 8, background: step === s.n ? '#f3f0ff' : 'transparent', cursor: step > s.n ? 'pointer' : 'default' }}
              onClick={() => { if (step > s.n) setStep(s.n) }}
            >
              <div className={`wizard-step-num ${step > s.n ? 'step-done' : step === s.n ? 'step-active' : 'step-future'}`}>
                {step > s.n ? '✓' : s.n}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: step >= s.n ? '#1e293b' : '#94a3b8' }}>{s.label}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc' }}>
        {/* ── Step 1: Customer ── */}
        {step === 1 && (
          <div style={{ padding: '40px 48px', maxWidth: 700 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>Find or Create Customer</h2>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 28px' }}>Search for an existing customer or add a new one.</p>

            {selectedCustomer ? (
              <>
                <div className="cust-selected">
                  {selectedCustomer.logo_url ? (
                    <img src={selectedCustomer.logo_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'contain', background: '#f1f5f9', border: '1px solid #e2e8f0' }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16 }}>
                      {selectedCustomer.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>{selectedCustomer.name}</div>
                    {(selectedCustomer.billing_city || selectedCustomer.billing_state) && (
                      <div style={{ fontSize: 13, color: '#64748b' }}>{[selectedCustomer.billing_city, selectedCustomer.billing_state].filter(Boolean).join(', ')}</div>
                    )}
                  </div>
                  <StatusBadge status={selectedCustomer.client_status} />
                  <button onClick={() => { setSelectedCustomer(null); setSelectedContact(null) }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>✕</button>
                </div>

                {/* Contact selector */}
                {customerContacts.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <label className="wiz-label">Contact (optional)</label>
                    <select className="wiz-input" value={selectedContact?.id ?? ''} onChange={e => {
                      const c = customerContacts.find(x => x.id === e.target.value)
                      setSelectedContact(c ?? null)
                    }}>
                      <option value="">— No specific contact —</option>
                      {customerContacts.map(c => (
                        <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.email ? ` (${c.email})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-next" style={{ padding: '11px 24px' }} onClick={() => setStep(2)}>
                    Next: Choose Items →
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Search */}
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
                  <input
                    autoFocus
                    type="text"
                    className="wiz-input"
                    placeholder="Search by company name, email…"
                    value={custSearch}
                    onChange={e => setCustSearch(e.target.value)}
                    style={{ paddingLeft: 38 }}
                  />
                </div>

                {custLoading && <div style={{ color: '#94a3b8', fontSize: 13, padding: '8px 0' }}>Searching…</div>}

                {custResults.length > 0 && (
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                    {custResults.map(c => (
                      <div key={c.id} className="cust-result" onClick={() => { setSelectedCustomer(c); setCustSearch(''); setCustResults([]) }}>
                        {c.logo_url ? (
                          <img src={c.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'contain', background: '#f8fafc', border: '1px solid #e2e8f0' }} />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: 6, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13 }}>
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{c.name}</div>
                          {(c.billing_city || c.billing_state) && (
                            <div style={{ fontSize: 12, color: '#64748b' }}>{[c.billing_city, c.billing_state].filter(Boolean).join(', ')}</div>
                          )}
                        </div>
                        <StatusBadge status={c.client_status} />
                      </div>
                    ))}
                  </div>
                )}

                {custSearch && !custLoading && custResults.length === 0 && (
                  <div style={{ background: '#fffbf0', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 14, color: '#92400e' }}>
                    No customers found for &ldquo;{custSearch}&rdquo;
                  </div>
                )}

                {/* New customer form */}
                <button
                  onClick={() => setShowNewCustomer(v => !v)}
                  style={{ background: showNewCustomer ? '#f3f0ff' : 'white', border: '1px dashed #7c3aed', borderRadius: 10, padding: '12px 18px', color: '#7c3aed', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'left', marginBottom: 16 }}
                >
                  + Create New Customer
                </button>

                {showNewCustomer && (
                  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 20px', marginBottom: 16 }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>New Customer</h3>
                    <div style={{ marginBottom: 14 }}>
                      <label className="wiz-label">Company Name <span style={{ color: '#dc2626' }}>*</span></label>
                      <input className="wiz-input" value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="Acme Corporation" />
                    </div>
                    <div className="form-grid2" style={{ marginBottom: 14 }}>
                      <div>
                        <label className="wiz-label">Contact First Name</label>
                        <input className="wiz-input" value={newCustFirstName} onChange={e => setNewCustFirstName(e.target.value)} placeholder="James" />
                      </div>
                      <div>
                        <label className="wiz-label">Contact Last Name</label>
                        <input className="wiz-input" value={newCustLastName} onChange={e => setNewCustLastName(e.target.value)} placeholder="Walker" />
                      </div>
                    </div>
                    <div className="form-grid2" style={{ marginBottom: 14 }}>
                      <div>
                        <label className="wiz-label">Email</label>
                        <input className="wiz-input" type="email" value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} placeholder="james@acme.com" />
                      </div>
                      <div>
                        <label className="wiz-label">Phone</label>
                        <input className="wiz-input" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} placeholder="(555) 000-0000" />
                      </div>
                    </div>
                    <div className="form-grid2" style={{ marginBottom: 18 }}>
                      <div>
                        <label className="wiz-label">City</label>
                        <input className="wiz-input" value={newCustCity} onChange={e => setNewCustCity(e.target.value)} placeholder="Chicago" />
                      </div>
                      <div>
                        <label className="wiz-label">State</label>
                        <input className="wiz-input" value={newCustState} onChange={e => setNewCustState(e.target.value)} placeholder="IL" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button onClick={() => setShowNewCustomer(false)} className="btn-back" style={{ padding: '9px 18px' }}>Cancel</button>
                      <button
                        onClick={handleSaveNewCustomer}
                        disabled={!newCustName.trim() || savingCust}
                        className="btn-next"
                        style={{ padding: '9px 18px', opacity: (!newCustName.trim() || savingCust) ? .5 : 1 }}
                      >
                        {savingCust ? 'Saving…' : 'Save & Select'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Step 2: Items ── */}
        {step === 2 && (
          <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Left: idea browser */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 32px 32px 40px' }}>
              {/* Customer summary */}
              {selectedCustomer && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>
                    {selectedCustomer.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, color: '#1e293b' }}>{selectedCustomer.name}</span>
                    {selectedContact && <span style={{ color: '#64748b', fontSize: 13 }}> · {selectedContact.first_name} {selectedContact.last_name}</span>}
                  </div>
                  <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Change</button>
                </div>
              )}

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 9, padding: 4, width: 'fit-content', marginBottom: 20 }}>
                <button onClick={() => setItemTab('ideas')} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', background: itemTab === 'ideas' ? '#7c3aed' : 'transparent', color: itemTab === 'ideas' ? 'white' : '#64748b' }}>
                  Pick from Ideas
                </button>
                <button onClick={() => setItemTab('custom')} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', background: itemTab === 'custom' ? '#7c3aed' : 'transparent', color: itemTab === 'custom' ? 'white' : '#64748b' }}>
                  Custom Item
                </button>
              </div>

              {itemTab === 'ideas' && (
                <>
                  <div style={{ position: 'relative', marginBottom: 16 }}>
                    <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
                    <input
                      className="wiz-input"
                      placeholder="Search ideas, categories, or keywords…"
                      value={ideaSearch}
                      onChange={e => setIdeaSearch(e.target.value)}
                      style={{ paddingLeft: 34 }}
                    />
                  </div>

                  {/* Suggestions */}
                  {!ideaSearch && suggestions.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>✨</span> Suggested for this customer
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                        {suggestions.map(idea => {
                          const isSelected = selectedItems.some(i => i.idea?.id === idea.id)
                          return (
                            <div
                              key={idea.id}
                              className={`idea-card ${isSelected ? 'idea-card-selected' : ''}`}
                              onClick={() => handleSelectIdea(idea)}
                            >
                              <div style={{ position: 'relative', height: 100, background: '#f8fafc', overflow: 'hidden' }}>
                                {idea.image_url ? <img src={idea.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                                {isSelected && <div className="check-overlay"><svg width="12" height="12" fill="white" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>}
                              </div>
                              <div style={{ padding: '8px 10px' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', lineHeight: 1.3 }}>{idea.item_name}</div>
                                <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>{idea.vendor}</div>
                                {idea.price_range && <div style={{ fontSize: 11, color: '#374151', marginTop: 2, fontWeight: 600 }}>{idea.price_range}</div>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* All ideas */}
                  {ideasLoading ? (
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
                      {ideas.map(idea => {
                        const isSelected = selectedItems.some(i => i.idea?.id === idea.id)
                        return (
                          <div
                            key={idea.id}
                            className={`idea-card ${isSelected ? 'idea-card-selected' : ''}`}
                            onClick={() => handleSelectIdea(idea)}
                          >
                            <div style={{ position: 'relative', height: 120, background: '#f8fafc', overflow: 'hidden' }}>
                              {idea.image_url ? <img src={idea.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#cbd5e1" strokeWidth={1}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path strokeLinecap="round" d="M21 15l-5-5L5 21"/></svg>
                                </div>
                              )}
                              {isSelected && <div className="check-overlay"><svg width="12" height="12" fill="white" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div>}
                            </div>
                            <div style={{ padding: '8px 10px' }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', lineHeight: 1.3 }}>{idea.item_name}</div>
                              <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>{idea.vendor}</div>
                              {idea.price_range && <div style={{ fontSize: 11, color: '#374151', marginTop: 2, fontWeight: 600 }}>{idea.price_range}</div>}
                              {idea.category && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{idea.category}</div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {itemTab === 'custom' && (
                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, maxWidth: 480 }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Enter Custom Item</h3>
                  <div style={{ marginBottom: 12 }}>
                    <label className="wiz-label">Item Name <span style={{ color: '#dc2626' }}>*</span></label>
                    <input className="wiz-input" value={customItem.item_name} onChange={e => setCustomItem(v => ({ ...v, item_name: e.target.value }))} placeholder="20oz Stainless Tumbler" />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label className="wiz-label">Vendor URL</label>
                    <input className="wiz-input" type="url" value={customItem.vendor_link} onChange={e => setCustomItem(v => ({ ...v, vendor_link: e.target.value }))} placeholder="https://..." />
                  </div>
                  <button
                    onClick={handleAddCustomItem}
                    disabled={!customItem.item_name.trim()}
                    className="btn-next"
                    style={{ padding: '9px 20px', opacity: !customItem.item_name.trim() ? .5 : 1 }}
                  >
                    Add to Spec
                  </button>
                </div>
              )}

              {/* Nav buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
                <button className="btn-back" style={{ padding: '10px 20px' }} onClick={() => setStep(1)}>← Back</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>Step 2 of 5</span>
                  <button
                    className="btn-next"
                    style={{ padding: '10px 22px', opacity: selectedItems.length === 0 ? .5 : 1 }}
                    disabled={selectedItems.length === 0}
                    onClick={() => setStep(3)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>

            {/* Right: basket */}
            <div style={{ width: 280, background: 'white', borderLeft: '1px solid #e2e8f0', padding: '24px 20px', overflowY: 'auto', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                Selected Items ({selectedItems.length})
              </div>
              {selectedItems.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No items selected yet</div>
              ) : (
                <>
                  {selectedItems.map((item, idx) => (
                    <div key={idx} className="basket-item">
                      {item.idea?.image_url ? (
                        <img src={item.idea.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 6, background: '#f1f5f9', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.item_name}</div>
                        {item.vendor && <div style={{ fontSize: 11, color: '#7c3aed' }}>{item.vendor}</div>}
                        {item.idea?.price_range && <div style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{item.idea.price_range}</div>}
                      </div>
                      <button
                        onClick={() => setSelectedItems(prev => prev.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {fmtRange(selectedItems) && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>Est. Price Range ({selectedItems.length} items)</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>{fmtRange(selectedItems)}</div>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedItems([])}
                    style={{ width: '100%', background: 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '7px 0', color: '#64748b', fontSize: 13, cursor: 'pointer', marginTop: 12 }}
                  >
                    Clear All
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Details ── */}
        {step === 3 && (
          <div style={{ padding: '40px 48px', maxWidth: 680 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>Spec Details</h2>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 28px' }}>Add PO numbers, dates, and notes for each item.</p>

            {/* Sales rep + CSR */}
            <div className="form-grid2" style={{ marginBottom: 20, background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
              <div>
                <label className="wiz-label">Sales Rep</label>
                <select className="wiz-input" value={salesRepId} onChange={e => setSalesRepId(e.target.value)}>
                  <option value="">— Select —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                </select>
              </div>
              <div>
                <label className="wiz-label">Assigned CSR</label>
                <select className="wiz-input" value={assignedCsrId} onChange={e => setAssignedCsrId(e.target.value)}>
                  <option value="">— Me (default) —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                </select>
              </div>
            </div>

            {selectedItems.map((item, idx) => (
              <div key={idx} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  {item.idea?.image_url ? (
                    <img src={item.idea.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', background: '#f8fafc' }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f1f5f9' }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{item.item_name}</div>
                    {item.vendor && <div style={{ fontSize: 13, color: '#7c3aed' }}>{item.vendor}</div>}
                  </div>
                </div>

                <div className="form-grid2" style={{ marginBottom: 14 }}>
                  <div>
                    <label className="wiz-label">PO #</label>
                    <input className="wiz-input" value={itemDetails[idx]?.po_number ?? ''} onChange={e => updateItemDetail(idx, 'po_number', e.target.value)} placeholder={`SPEC-${new Date().getFullYear()}-${String(idx + 1).padStart(3, '0')}`} />
                  </div>
                  <div>
                    <label className="wiz-label">Order Date</label>
                    <input className="wiz-input" type="date" value={itemDetails[idx]?.order_date ?? item.order_date} onChange={e => updateItemDetail(idx, 'order_date', e.target.value)} />
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className="wiz-label">Date Sent <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional — set later if not yet sent)</span></label>
                  <input className="wiz-input" type="date" value={itemDetails[idx]?.date_sent ?? ''} onChange={e => updateItemDetail(idx, 'date_sent', e.target.value)} style={{ width: 200 }} />
                </div>
                <div>
                  <label className="wiz-label">Notes</label>
                  <textarea className="wiz-input" rows={2} value={itemDetails[idx]?.notes ?? ''} onChange={e => updateItemDetail(idx, 'notes', e.target.value)} placeholder="Internal notes about this item…" style={{ resize: 'vertical' }} />
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <button className="btn-back" style={{ padding: '10px 20px' }} onClick={() => setStep(2)}>← Back</button>
              <button className="btn-next" style={{ padding: '10px 22px' }} onClick={() => setStep(4)}>Next →</button>
            </div>
          </div>
        )}

        {/* ── Step 4: Follow-up ── */}
        {step === 4 && (
          <div style={{ padding: '40px 48px', maxWidth: 580 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>Follow-up Plan</h2>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 28px' }}>Set a follow-up reminder to check back with the customer.</p>

            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '24px 24px', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <input
                  type="checkbox"
                  id="create_task"
                  checked={createTask}
                  onChange={e => setCreateTask(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#7c3aed', cursor: 'pointer' }}
                />
                <label htmlFor="create_task" style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
                  Create follow-up task in CRM
                </label>
              </div>

              {createTask && (
                <>
                  <div className="form-grid2" style={{ marginBottom: 16 }}>
                    <div>
                      <label className="wiz-label">Follow-up Date</label>
                      <input className="wiz-input" type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="wiz-label">Note / Instructions</label>
                    <textarea
                      className="wiz-input"
                      rows={3}
                      value={followUpNotes}
                      onChange={e => setFollowUpNotes(e.target.value)}
                      placeholder={selectedItems.length > 0 ? `Following up on spec sample${selectedItems.length > 1 ? 's' : ''} sent for ${selectedItems.map(i => i.item_name).join(', ')}` : 'Following up on spec sample…'}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  {createTask && (
                    <div style={{ marginTop: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>TASK PREVIEW</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                        Follow up: {selectedCustomer?.name ?? '…'} — {selectedItems[0]?.item_name ?? '…'}
                        {selectedItems.length > 1 ? ` +${selectedItems.length - 1} more` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Due {followUpDate} · CRM · Medium priority</div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn-back" style={{ padding: '10px 20px' }} onClick={() => setStep(3)}>← Back</button>
              <button className="btn-next" style={{ padding: '10px 22px' }} onClick={() => setStep(5)}>Review →</button>
            </div>
          </div>
        )}

        {/* ── Step 5: Review ── */}
        {step === 5 && (
          <div style={{ padding: '40px 48px', maxWidth: 640 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>Review & Confirm</h2>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 28px' }}>Confirm the details before creating the spec.</p>

            {/* Customer */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Customer</div>
                <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
              </div>
              <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 15 }}>{selectedCustomer?.name}</div>
              {selectedContact && <div style={{ fontSize: 13, color: '#64748b' }}>{selectedContact.first_name} {selectedContact.last_name}{selectedContact.email ? ` · ${selectedContact.email}` : ''}</div>}
            </div>

            {/* Items */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Items ({selectedItems.length})</div>
                <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
              </div>
              {selectedItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: idx < selectedItems.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  {item.idea?.image_url ? <img src={item.idea.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 40, height: 40, borderRadius: 6, background: '#f1f5f9', flexShrink: 0 }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{itemDetails[idx]?.item_name ?? item.item_name}</div>
                    {item.vendor && <div style={{ fontSize: 12, color: '#7c3aed' }}>{item.vendor}</div>}
                    {item.idea?.price_range && <div style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{item.idea.price_range}</div>}
                  </div>
                  {itemDetails[idx]?.po_number && <div style={{ fontSize: 12, color: '#64748b' }}>PO: {itemDetails[idx].po_number}</div>}
                </div>
              ))}
            </div>

            {/* Follow-up */}
            {createTask && followUpDate && (
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Follow-up Task</div>
                  <button onClick={() => setStep(4)} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                  Follow up: {selectedCustomer?.name} — {selectedItems[0]?.item_name}
                  {selectedItems.length > 1 ? ` +${selectedItems.length - 1} more` : ''}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Due {followUpDate}</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn-back" style={{ padding: '10px 20px' }} onClick={() => setStep(4)}>← Back</button>
              <button
                onClick={handleSubmit}
                disabled={saving || !selectedCustomer || selectedItems.length === 0}
                style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 9, padding: '12px 28px', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: (saving || !selectedCustomer || selectedItems.length === 0) ? .5 : 1 }}
              >
                {saving ? 'Creating…' : `Confirm & Create ${selectedItems.length} Spec${selectedItems.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 6: Success ── */}
        {step === 6 && (
          <div style={{ padding: '80px 48px', maxWidth: 480, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>Spec{createdIds.length > 1 ? 's' : ''} Created!</h2>
            <p style={{ color: '#64748b', fontSize: 15, margin: '0 0 28px' }}>
              {createdIds.length} spec{createdIds.length > 1 ? 's' : ''} created for {selectedCustomer?.name}.
              {createTask && followUpDate ? ` A follow-up task has been scheduled for ${followUpDate}.` : ''}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {createdIds[0] && (
                <Link href={`/marketing/specs/${createdIds[0]}`} style={{ background: '#7c3aed', color: 'white', padding: '11px 22px', borderRadius: 9, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                  View Spec →
                </Link>
              )}
              <button
                onClick={() => {
                  setStep(1)
                  setSelectedCustomer(null)
                  setSelectedContact(null)
                  setSelectedItems([])
                  setItemDetails({})
                  setCreatedIds([])
                  setCustSearch('')
                }}
                style={{ background: 'white', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 9, padding: '11px 22px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                Start Another Spec
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
