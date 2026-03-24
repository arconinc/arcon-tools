'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import TagPicker from '@/components/crm/TagPicker'
import { formatPhoneInput } from '@/lib/phone'

type TagOption = { id: string; name: string; color: string }

const PRODUCT_LINE_OPTIONS = [
  'Apparel - Decorator', 'Apparel - Blank Warehouse', 'Hard Goods', 'Hats', 'USB', 'Awards',
  'Pins & Jewelry', 'Namebadge', 'Checks, Stationary, Forms & Envelopes', 'Commercial & Long Run',
  'Signs', 'Large Format', 'Folders', 'Ribbon & Thermal', 'Toner', 'Mailing', 'Labels & Tags',
  'Safety Apparel/PPE',
]

const SPECIALTY_OPTIONS = [
  'Print', 'Promo', 'Office Supply & Stock & Toner', 'Signs', 'Packaging',
  'Warehouse & Carrier & Courier', 'Artwork', 'Other',
]

type BrandDataLocal = {
  id: string; domain: string; brandfetch_id: string | null; name: string | null
  description: string | null; long_description: string | null
  logo_url: string | null; icon_url: string | null
  colors: { hex: string; type: string; brightness: number }[] | null
  links: { name: string; url: string }[] | null
  company: {
    employees: number | null; foundedYear: number | null
    industries: { name: string; slug: string }[] | null
    location: { city: string | null; state: string | null; country: string | null } | null
    kind: string | null
  } | null
  fetched_at: string
}

type VendorDetail = {
  id: string; name: string; phone: string | null; website: string | null; linkedin: string | null
  description: string | null; tags: TagOption[]
  premier_group_member: boolean; product_line: string | null; specialty: string | null
  arcon_account_number: string | null; online_store: string | null
  arcon_username: string | null; arcon_password: string | null
  customer_service_email: string | null; orders_email: string | null; orders_cutoff: string | null
  rush_order_email: string | null; rush_order_cutoff: string | null; rush_art_email: string | null
  rush_art_cutoff: string | null
  artwork_email: string | null; samples_email: string | null; virtuals_email: string | null
  spec_sample_email: string | null
  billing_address1: string | null; billing_address2: string | null; billing_city: string | null
  billing_state: string | null; billing_zip: string | null; billing_country: string | null
  shipping_address1: string | null; shipping_address2: string | null; shipping_city: string | null
  shipping_state: string | null; shipping_zip: string | null; shipping_country: string | null
  notes: string | null
  logo_url: string | null; brand_data_id: string | null; brand_data: BrandDataLocal | null
  created_by: string; created_at: string; updated_at: string
  contacts: { id: string; first_name: string; last_name: string; title: string | null; email: string | null; phone: string | null }[]
  files: { id: string; label: string; url: string; created_at: string }[]
  created_by_user: { id: string; display_name: string; email: string } | null
}

const SOCIAL_COLORS: Record<string, string> = {
  linkedin: '#0A66C2', twitter: '#000000', x: '#000000', instagram: '#E1306C',
  facebook: '#1877F2', youtube: '#FF0000', github: '#333333', tiktok: '#010101',
  pinterest: '#E60023',
}

function SocialIcon({ name }: { name: string }) {
  const n = name.toLowerCase()
  const color = SOCIAL_COLORS[n] ?? '#64748b'
  const cls = "w-4 h-4"
  if (n === 'linkedin') return (
    <svg className={cls} viewBox="0 0 24 24" fill={color}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
  )
  if (n === 'twitter' || n === 'x') return (
    <svg className={cls} viewBox="0 0 24 24" fill={color}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
  )
  if (n === 'instagram') return (
    <svg className={cls} viewBox="0 0 24 24" fill={color}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
  )
  if (n === 'facebook') return (
    <svg className={cls} viewBox="0 0 24 24" fill={color}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
  )
  if (n === 'youtube') return (
    <svg className={cls} viewBox="0 0 24 24" fill={color}><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
  )
  if (n === 'github') return (
    <svg className={cls} viewBox="0 0 24 24" fill={color}><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
  )
  if (n === 'tiktok') return (
    <svg className={cls} viewBox="0 0 24 24" fill={color}><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
  )
  if (n === 'pinterest') return (
    <svg className={cls} viewBox="0 0 24 24" fill={color}><path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
  )
  // Generic globe fallback
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={1.5}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
  )
}

function buildCompanySummary(company: BrandDataLocal['company']): string | null {
  if (!company) return null
  const parts: string[] = []
  const kind = company.kind === 'PUBLIC_COMPANY' ? 'a public company'
    : company.kind === 'PRIVATE_COMPANY' ? 'a private company' : null
  const location = [company.location?.city, company.location?.state, company.location?.country].filter(Boolean).join(', ')
  const industry = company.industries?.map((i) => i.name).join(' and ')
  if (kind && company.foundedYear) parts.push(`${kind} founded in ${company.foundedYear}`)
  else if (kind) parts.push(kind)
  else if (company.foundedYear) parts.push(`founded in ${company.foundedYear}`)
  if (location) parts.push(`headquartered in ${location}`)
  if (company.employees) parts.push(`approximately ${company.employees} employees`)
  if (industry) parts.push(`operating in ${industry}`)
  return parts.length ? parts.join(', ') + '.' : null
}

function Field({ label, value, password, multiline, link, email }: { label: string; value: string | null | undefined; password?: boolean; multiline?: boolean; link?: boolean; email?: boolean }) {
  const display = value
    ? password ? '••••••••'
      : link
        ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-purple-700 hover:underline break-all">{value.replace(/^https?:\/\//, '')}</a>
        : email
          ? <a href={`mailto:${value}`} className="text-purple-700 hover:underline">{value}</a>
          : <span className={multiline ? 'whitespace-pre-wrap' : ''}>{value}</span>
    : <span className="text-slate-400">—</span>
  return (
    <div>
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-sm text-slate-800">{display}</div>
    </div>
  )
}

function FI({ label, name, value, onChange, type = 'text', textarea = false, rows = 3 }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void; type?: string; textarea?: boolean; rows?: number
}) {
  const cls = "w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{label}</label>
      {textarea
        ? <textarea rows={rows} value={value} onChange={(e) => onChange(name, e.target.value)} className={cls + ' resize-none'} />
        : <input type={type} value={value} onChange={(e) => onChange(name, e.target.value)} className={cls} />
      }
    </div>
  )
}

function FS({ label, name, value, onChange, options }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void; options: string[]
}) {
  const cls = "w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{label}</label>
      <select value={value} onChange={(e) => onChange(name, e.target.value)} className={cls}>
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

export default function VendorDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const isNew = id === 'new'

  const [vendor, setVendor] = useState<VendorDetail | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'related' | 'activity'>('details')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<VendorDetail>>({})
  const [saving, setSaving] = useState(false)

  const [tagIds, setTagIds] = useState<string[]>([])
  const [tagSaving, setTagSaving] = useState(false)

  const [brandData, setBrandData] = useState<BrandDataLocal | null>(null)
  const [brandFetching, setBrandFetching] = useState(false)
  const [brandError, setBrandError] = useState<string | null>(null)
  const [brandShowFull, setBrandShowFull] = useState(false)

  useEffect(() => {
    if (vendor) setTagIds((vendor.tags ?? []).map((t) => t.id))
    if (vendor?.brand_data) setBrandData(vendor.brand_data)
  }, [vendor])

  async function fetchBrandData() {
    if (!vendor) return
    setBrandFetching(true)
    setBrandError(null)
    try {
      const res = await fetch('/api/crm/brand-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'vendor', entity_id: vendor.id }),
      })
      const data = await res.json()
      if (!res.ok) { setBrandError(data.message ?? 'Failed to fetch brand data.'); return }
      setBrandData(data.brand_data)
      setVendor((prev) => prev ? {
        ...prev,
        logo_url: data.brand_data.logo_url,
        brand_data: data.brand_data,
        ...(data.linkedin ? { linkedin: data.linkedin } : {}),
      } : prev)
    } finally { setBrandFetching(false) }
  }

  async function handleTagsChange(newIds: string[]) {
    setTagIds(newIds)
    if (!vendor?.id) return
    setTagSaving(true)
    try {
      await fetch(`/api/crm/vendors/${vendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_ids: newIds }),
      })
    } finally { setTagSaving(false) }
  }

  const [createForm, setCreateForm] = useState({
    name: '', phone: '', website: '', linkedin: '', description: '', product_line: '', specialty: '',
    rush_art_cutoff: '',
    billing_address1: '', billing_address2: '', billing_city: '', billing_state: '', billing_zip: '', billing_country: '',
    shipping_address1: '', shipping_address2: '', shipping_city: '', shipping_state: '', shipping_zip: '', shipping_country: '',
    notes: '',
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    fetch(`/api/crm/vendors/${id}`)
      .then((r) => r.json())
      .then((data) => { if (data.error) { setError(data.error); return } setVendor(data) })
      .catch(() => setError('Failed to load vendor'))
      .finally(() => setLoading(false))
  }, [id, isNew])

  function startEdit() { if (!vendor) return; setEditForm({ ...vendor }); setEditing(true) }
  function cancelEdit() { setEditing(false); setEditForm({}) }
  function handleEditChange(field: string, value: string | boolean) {
    const formatted = field === 'phone' && typeof value === 'string' ? formatPhoneInput(value) : value
    setEditForm((prev) => ({ ...prev, [field]: typeof formatted === 'string' ? (formatted || null) : formatted }))
  }

  async function saveEdit() {
    if (!vendor) return
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/vendors/${vendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Save failed'); return }
      setVendor((prev) => prev ? { ...prev, ...data } : prev)
      setEditing(false)
    } finally { setSaving(false) }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.name.trim()) { setCreateError('Name is required'); return }
    setCreating(true); setCreateError(null)
    try {
      const res = await fetch('/api/crm/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          phone: createForm.phone || null, website: createForm.website || null,
          linkedin: createForm.linkedin || null, description: createForm.description || null,
          product_line: createForm.product_line || null, specialty: createForm.specialty || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Create failed'); return }
      router.push(`/crm/vendors/${data.id}`)
    } finally { setCreating(false) }
  }

  if (isNew) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-6">
        <Link href="/crm/vendors" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Vendors
        </Link>
        <h1 className="text-xl font-bold text-slate-900 mb-4">New Vendor</h1>
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          {createError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createError}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Name <span className="text-red-500">*</span></label>
            <input type="text" value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} required
              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Phone</label>
              <input type="tel" value={createForm.phone} onChange={(e) => setCreateForm((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Website</label>
              <input type="url" value={createForm.website} onChange={(e) => setCreateForm((p) => ({ ...p, website: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Product Line</label>
              <select value={createForm.product_line} onChange={(e) => setCreateForm((p) => ({ ...p, product_line: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                <option value="">—</option>
                {PRODUCT_LINE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Specialty</label>
              <select value={createForm.specialty} onChange={(e) => setCreateForm((p) => ({ ...p, specialty: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                <option value="">—</option>
                {SPECIALTY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Description</label>
            <textarea rows={3} value={createForm.description} onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={creating}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors">
              {creating ? 'Creating…' : 'Create Vendor'}
            </button>
            <Link href="/crm/vendors" className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="px-6 py-5 animate-pulse space-y-3">
        <div className="h-5 bg-slate-100 rounded w-24" />
        <div className="h-24 bg-slate-100 rounded-2xl" />
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
    )
  }

  if (error || !vendor) {
    return (
      <div className="px-6 py-5">
        <Link href="/crm/vendors" className="text-sm text-slate-500 hover:text-slate-700">← Vendors</Link>
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error ?? 'Vendor not found'}</div>
      </div>
    )
  }

  const ef = editForm as Partial<VendorDetail>

  return (
    <div className="px-6 py-5">
      <Link href="/crm/vendors" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Vendors
      </Link>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
        <div className="flex items-center gap-4">
          {vendor.logo_url && (
            <img
              src={vendor.logo_url}
              alt={`${vendor.name} logo`}
              className="h-10 w-auto max-w-[180px] object-contain flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{vendor.name}</h1>
              {vendor.premier_group_member && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Premier Group</span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              {vendor.product_line && <span className="text-xs text-slate-500">{vendor.product_line}</span>}
              {vendor.phone && <span className="text-xs text-slate-500">{vendor.phone}</span>}
              {vendor.website && (
                <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-700 hover:underline">
                  {vendor.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        {(['details', 'related', 'activity'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg capitalize transition-colors ${
              activeTab === tab ? 'bg-purple-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}>
            {tab}
            {tab === 'related' && vendor.contacts.length + vendor.files.length > 0 && (
              <span className="ml-1.5 text-xs opacity-70">{vendor.contacts.length + vendor.files.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-3 gap-4 items-start">
          {/* Main column — 66% */}
          <div className="col-span-2 space-y-3">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {/* Org Info header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-700">Organization Info</h2>
                {!editing ? (
                  <button onClick={startEdit} className="px-3 py-1 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">Edit</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving} className="px-3 py-1 text-xs font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-60 transition-colors">{saving ? 'Saving…' : 'Save'}</button>
                    <button onClick={cancelEdit} className="px-3 py-1 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">Cancel</button>
                  </div>
                )}
              </div>

              {/* Basic fields */}
              <div className="px-5 py-4 grid grid-cols-3 gap-3">
                {editing ? (
                  <>
                    <FI label="Name" name="name" value={(ef.name as string) ?? ''} onChange={handleEditChange} />
                    <FI label="Phone" name="phone" value={(ef.phone as string) ?? ''} onChange={handleEditChange} type="tel" />
                    <FI label="Website" name="website" value={(ef.website as string) ?? ''} onChange={handleEditChange} type="url" />
                    <div className="col-span-3">
                      <FI label="LinkedIn" name="linkedin" value={(ef.linkedin as string) ?? ''} onChange={handleEditChange} type="url" />
                    </div>
                    <div className="col-span-3">
                      <FI label="Description" name="description" value={(ef.description as string) ?? ''} onChange={handleEditChange} textarea />
                    </div>
                  </>
                ) : (
                  <>
                    <Field label="Phone" value={vendor.phone} />
                    <Field label="Website" value={vendor.website} link />
                    <Field label="LinkedIn" value={vendor.linkedin} link />
                    <div className="col-span-3"><Field label="Description" value={vendor.description} /></div>
                  </>
                )}
              </div>

              {/* Vendor Account section */}
              <div className="border-t border-slate-100">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-700">Vendor Account</h2>
                </div>
                <div className="px-5 py-4 grid grid-cols-4 gap-3">
                  {editing ? (
                    <>
                      <div className="col-span-4 flex items-center gap-3 pb-1">
                        <input type="checkbox" id="premier" checked={!!(ef.premier_group_member)} onChange={(e) => handleEditChange('premier_group_member', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-400" />
                        <label htmlFor="premier" className="text-sm text-slate-700 font-medium">Premier Group Member</label>
                      </div>
                      <FS label="Product Line" name="product_line" value={(ef.product_line as string) ?? ''} onChange={handleEditChange} options={PRODUCT_LINE_OPTIONS} />
                      <FS label="Specialty" name="specialty" value={(ef.specialty as string) ?? ''} onChange={handleEditChange} options={SPECIALTY_OPTIONS} />
                      <FI label="Arcon Account #" name="arcon_account_number" value={(ef.arcon_account_number as string) ?? ''} onChange={handleEditChange} />
                      <FI label="Online Store" name="online_store" value={(ef.online_store as string) ?? ''} onChange={handleEditChange} type="url" />
                      <FI label="Arcon Username" name="arcon_username" value={(ef.arcon_username as string) ?? ''} onChange={handleEditChange} />
                      <FI label="Arcon Password" name="arcon_password" value={(ef.arcon_password as string) ?? ''} onChange={handleEditChange} />
                    </>
                  ) : (
                    <>
                      <Field label="Product Line" value={vendor.product_line} />
                      <Field label="Specialty" value={vendor.specialty} />
                      <Field label="Arcon Account #" value={vendor.arcon_account_number} />
                      <Field label="Online Store" value={vendor.online_store} link />
                      <Field label="Arcon Username" value={vendor.arcon_username} />
                      <Field label="Arcon Password" value={vendor.arcon_password} password />
                    </>
                  )}
                </div>
              </div>

              {/* Contact Emails & Cutoffs */}
              <div className="border-t border-slate-100">
                <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-0.5 h-3.5 bg-purple-300 rounded-full" />
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Contact Emails &amp; Cutoffs</h3>
                </div>
                {editing ? (
                  <div className="px-5 py-4 space-y-3">
                    {/* Standalone emails (no cutoff) */}
                    <div className="grid grid-cols-2 gap-3">
                      <FI label="Customer Service Email" name="customer_service_email" value={(ef.customer_service_email as string) ?? ''} onChange={handleEditChange} type="email" />
                      <FI label="Artwork Email" name="artwork_email" value={(ef.artwork_email as string) ?? ''} onChange={handleEditChange} type="email" />
                      <FI label="Samples Email" name="samples_email" value={(ef.samples_email as string) ?? ''} onChange={handleEditChange} type="email" />
                      <FI label="Virtuals Email" name="virtuals_email" value={(ef.virtuals_email as string) ?? ''} onChange={handleEditChange} type="email" />
                      <FI label="Spec Sample Email" name="spec_sample_email" value={(ef.spec_sample_email as string) ?? ''} onChange={handleEditChange} type="email" />
                    </div>
                    {/* Email + cutoff pairs */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1 border-t border-slate-100">
                      <div className="col-span-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mt-1">With Cutoff Times</div>
                      <FI label="Orders Email" name="orders_email" value={(ef.orders_email as string) ?? ''} onChange={handleEditChange} type="email" />
                      <FI label="Orders Cutoff" name="orders_cutoff" value={(ef.orders_cutoff as string) ?? ''} onChange={handleEditChange} />
                      <FI label="Rush Order Email" name="rush_order_email" value={(ef.rush_order_email as string) ?? ''} onChange={handleEditChange} type="email" />
                      <FI label="Rush Order Cutoff" name="rush_order_cutoff" value={(ef.rush_order_cutoff as string) ?? ''} onChange={handleEditChange} />
                      <FI label="Rush Art Email" name="rush_art_email" value={(ef.rush_art_email as string) ?? ''} onChange={handleEditChange} type="email" />
                      <FI label="Rush Art Cutoff" name="rush_art_cutoff" value={(ef.rush_art_cutoff as string) ?? ''} onChange={handleEditChange} />
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-4">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-50">
                        {[
                          { label: 'Customer Service', email: vendor.customer_service_email, cutoff: null },
                          { label: 'Orders', email: vendor.orders_email, cutoff: vendor.orders_cutoff },
                          { label: 'Rush Orders', email: vendor.rush_order_email, cutoff: vendor.rush_order_cutoff },
                          { label: 'Rush Art', email: vendor.rush_art_email, cutoff: vendor.rush_art_cutoff },
                          { label: 'Artwork', email: vendor.artwork_email, cutoff: null },
                          { label: 'Samples', email: vendor.samples_email, cutoff: null },
                          { label: 'Virtuals', email: vendor.virtuals_email, cutoff: null },
                          { label: 'Spec Sample', email: vendor.spec_sample_email, cutoff: null },
                        ].map((row) => (
                          <tr key={row.label} className="group">
                            <td className="py-1.5 pr-4 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap w-28">{row.label}</td>
                            <td className="py-1.5 pr-4 text-slate-700">
                              {row.email
                                ? <a href={`mailto:${row.email}`} className="text-purple-700 hover:underline">{row.email}</a>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-1.5 text-xs text-slate-500 whitespace-nowrap">
                              {row.cutoff ? <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">{row.cutoff}</span> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Billing + Shipping Address */}
              {(editing || vendor.billing_address1 || vendor.billing_city || vendor.shipping_address1 || vendor.shipping_city) && (
                <div className="border-t border-slate-100">
                  <div className="grid grid-cols-2 divide-x divide-slate-100">
                    {/* Billing */}
                    <div>
                      <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-0.5 h-3.5 bg-purple-300 rounded-full" />
                        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Billing Address</h3>
                      </div>
                      <div className="px-5 py-4">
                        {editing ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><FI label="Address 1" name="billing_address1" value={(ef.billing_address1 as string) ?? ''} onChange={handleEditChange} /></div>
                            <div className="col-span-2"><FI label="Address 2" name="billing_address2" value={(ef.billing_address2 as string) ?? ''} onChange={handleEditChange} /></div>
                            <FI label="City" name="billing_city" value={(ef.billing_city as string) ?? ''} onChange={handleEditChange} />
                            <FI label="State" name="billing_state" value={(ef.billing_state as string) ?? ''} onChange={handleEditChange} />
                            <FI label="ZIP" name="billing_zip" value={(ef.billing_zip as string) ?? ''} onChange={handleEditChange} />
                            <div className="col-span-2"><FI label="Country" name="billing_country" value={(ef.billing_country as string) ?? ''} onChange={handleEditChange} /></div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-800 leading-snug">
                            {vendor.billing_address1 && <div>{vendor.billing_address1}</div>}
                            {vendor.billing_address2 && <div>{vendor.billing_address2}</div>}
                            {(vendor.billing_city || vendor.billing_state || vendor.billing_zip) && (
                              <div>
                                {[vendor.billing_city, vendor.billing_state].filter(Boolean).join(', ')}
                                {vendor.billing_zip ? ` ${vendor.billing_zip}` : ''}
                              </div>
                            )}
                            {vendor.billing_country && <div>{vendor.billing_country}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Shipping */}
                    <div>
                      <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-0.5 h-3.5 bg-purple-300 rounded-full" />
                        <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Shipping Address</h3>
                      </div>
                      <div className="px-5 py-4">
                        {editing ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><FI label="Address 1" name="shipping_address1" value={(ef.shipping_address1 as string) ?? ''} onChange={handleEditChange} /></div>
                            <div className="col-span-2"><FI label="Address 2" name="shipping_address2" value={(ef.shipping_address2 as string) ?? ''} onChange={handleEditChange} /></div>
                            <FI label="City" name="shipping_city" value={(ef.shipping_city as string) ?? ''} onChange={handleEditChange} />
                            <FI label="State" name="shipping_state" value={(ef.shipping_state as string) ?? ''} onChange={handleEditChange} />
                            <FI label="ZIP" name="shipping_zip" value={(ef.shipping_zip as string) ?? ''} onChange={handleEditChange} />
                            <div className="col-span-2"><FI label="Country" name="shipping_country" value={(ef.shipping_country as string) ?? ''} onChange={handleEditChange} /></div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-800 leading-snug">
                            {vendor.shipping_address1 && <div>{vendor.shipping_address1}</div>}
                            {vendor.shipping_address2 && <div>{vendor.shipping_address2}</div>}
                            {(vendor.shipping_city || vendor.shipping_state || vendor.shipping_zip) && (
                              <div>
                                {[vendor.shipping_city, vendor.shipping_state].filter(Boolean).join(', ')}
                                {vendor.shipping_zip ? ` ${vendor.shipping_zip}` : ''}
                              </div>
                            )}
                            {vendor.shipping_country && <div>{vendor.shipping_country}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {(editing || vendor.notes) && (
                <div className="border-t border-slate-100">
                  <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                    <div className="w-0.5 h-3.5 bg-purple-300 rounded-full" />
                    <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Additional Information</h3>
                  </div>
                  <div className="px-5 py-4">
                    {editing
                      ? <FI label="Notes" name="notes" value={(ef.notes as string) ?? ''} onChange={handleEditChange} textarea rows={6} />
                      : <Field label="Notes" value={vendor.notes} multiline />
                    }
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 flex gap-6 text-xs text-slate-400">
                <span>Created {new Date(vendor.created_at).toLocaleDateString()} by {vendor.created_by_user?.display_name ?? '—'}</span>
                <span>Updated {new Date(vendor.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Sidebar — 25% */}
          <div className="space-y-3">
            {/* Tags card */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <h2 className="text-sm font-semibold text-slate-700">Tags</h2>
                </div>
                {tagSaving && <span className="text-xs text-slate-400">Saving…</span>}
              </div>
              <div className="p-3">
                <TagPicker value={tagIds} onChange={handleTagsChange} placeholder="Add tags…" />
              </div>
            </div>

            {/* Brand Insights card */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <h2 className="text-sm font-semibold text-slate-700">Brand Insights</h2>
                </div>
                <button
                  onClick={fetchBrandData}
                  disabled={brandFetching || !vendor.website}
                  className="px-2.5 py-1 text-xs font-semibold bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-lg transition-colors"
                  title={!vendor.website ? 'Add a website URL to this vendor first' : undefined}
                >
                  {brandFetching ? 'Fetching…' : brandData ? 'Refresh' : 'Fetch'}
                </button>
              </div>
              <div className="p-4">
                {brandData && <div className="text-xs text-slate-400 mb-3">Last fetched {new Date(brandData.fetched_at).toLocaleDateString()}</div>}
                {brandError && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 mb-3">{brandError}</div>
                )}
                {!brandData && !brandError && (
                  <p className="text-xs text-slate-400">
                    {vendor.website
                      ? 'Click "Fetch" to enrich this record with logo, description, and company information.'
                      : 'Add a website URL to enable brand data enrichment.'}
                  </p>
                )}
                {brandData && (
                  <div className="space-y-3">
                    {brandData.links && brandData.links.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {brandData.links.map((l) => (
                          <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={l.name}
                            className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition-colors flex-shrink-0">
                            <SocialIcon name={l.name} />
                          </a>
                        ))}
                      </div>
                    )}
                    {brandData.logo_url && (
                      <img
                        src={brandData.logo_url}
                        alt={`${vendor.name} logo`}
                        className="h-10 w-auto max-w-[180px] object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                    {brandData.description && (
                      <p className="text-xs text-slate-700 leading-relaxed">{brandData.description}</p>
                    )}
                    {buildCompanySummary(brandData.company) && (
                      <p className="text-xs text-slate-600 leading-relaxed italic">{buildCompanySummary(brandData.company)}</p>
                    )}
                    {brandData.long_description && (
                      <div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {brandShowFull || brandData.long_description.length <= 200
                            ? brandData.long_description
                            : brandData.long_description.slice(0, 200) + '…'}
                        </p>
                        {brandData.long_description.length > 200 && (
                          <button onClick={() => setBrandShowFull((v) => !v)} className="mt-1 text-xs text-purple-700 hover:underline">
                            {brandShowFull ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </div>
                    )}
                    {brandData.colors && brandData.colors.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Colors</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {brandData.colors.map((c, i) => (
                            <div key={i} title={c.hex} className="w-4 h-4 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: c.hex }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Related Tab */}
      {activeTab === 'related' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Contacts ({vendor.contacts.length})</h2>
              <button onClick={() => router.push(`/crm/contacts/new?vendor_id=${vendor.id}`)} className="text-xs font-semibold text-purple-700 hover:text-purple-900">+ Add</button>
            </div>
            {vendor.contacts.length === 0
              ? <div className="px-5 py-5 text-sm text-slate-400 text-center">No contacts linked.</div>
              : <div className="divide-y divide-slate-100">
                  {vendor.contacts.map((c) => (
                    <div key={c.id} onClick={() => router.push(`/crm/contacts/${c.id}`)}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                        {c.first_name[0]}{c.last_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800">{c.first_name} {c.last_name}</div>
                        {c.title && <div className="text-xs text-slate-400">{c.title}</div>}
                      </div>
                      <div className="text-xs text-slate-400 truncate max-w-[120px]">{c.email ?? ''}</div>
                    </div>
                  ))}
                </div>
            }
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Files ({vendor.files.length})</h2>
            </div>
            {vendor.files.length === 0
              ? <div className="px-5 py-5 text-sm text-slate-400 text-center">No files attached.</div>
              : <div className="divide-y divide-slate-100">
                  {vendor.files.map((f) => (
                    <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      <span className="text-sm text-purple-700 hover:underline">{f.label}</span>
                    </a>
                  ))}
                </div>
            }
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-400">
          Task activity for this vendor will appear here once the Tasks feature is complete.{' '}
          <button onClick={() => router.push(`/crm/tasks?vendor_id=${vendor.id}`)} className="text-purple-700 hover:underline">View tasks →</button>
        </div>
      )}
    </div>
  )
}
