'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PlacesAddressAutocomplete } from '@/components/crm/PlacesAddressAutocomplete'
import { formatPhoneInput } from '@/lib/phone'
import { useFormValidation, inputCls, selectCls, FieldError } from '@/lib/form-validation'
import { useAppUser } from '@/components/layout/AppShell'
import { useCrmUsers } from '@/hooks'
import type { PlacesAddress } from '@/lib/google-places'
import type { AturianCommissionedClient } from '@/types'

const COMMISSIONED_CLIENT_OPTIONS: AturianCommissionedClient[] = [
  'Standard', 'Standard with Split', 'Credit Card Store', 'Non-Credit card store',
]

type CreateForm = {
  company_name: string
  assigned_to: string
  is_online_client: boolean
  online_uses_cc: boolean
  commissioned_client: string
  tax_exempt: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
  phone: string
  website: string
  orderer_first_name: string
  orderer_last_name: string
  orderer_email: string
  ap_first_name: string
  ap_last_name: string
  ap_email: string
}

const EMPTY_FORM: CreateForm = {
  company_name: '', assigned_to: '', is_online_client: false, online_uses_cc: false,
  commissioned_client: '', tax_exempt: '',
  address1: '', address2: '', city: '', state: '', zip: '', phone: '', website: '',
  orderer_first_name: '', orderer_last_name: '', orderer_email: '',
  ap_first_name: '', ap_last_name: '', ap_email: '',
}

export default function AturianAddCustomerPage() {
  const router = useRouter()
  const { user: appUser } = useAppUser()
  const { data: crmUsersData } = useCrmUsers()
  const crmUsers = crmUsersData ?? []

  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const { errors, validate, clearError } = useFormValidation<CreateForm>()
  const [apDuplicateError, setApDuplicateError] = useState<string | null>(null)
  const [taxCertificateFile, setTaxCertificateFile] = useState<File | null>(null)
  const [taxCertificateError, setTaxCertificateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (appUser?.id && !form.assigned_to) {
      setForm((p) => ({ ...p, assigned_to: appUser.id }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.id])

  function applyAddress(address: PlacesAddress) {
    setForm((p) => ({
      ...p,
      address1: address.address1 ?? p.address1,
      address2: address.address2 ?? p.address2,
      city: address.city ?? p.city,
      state: address.state ?? p.state,
      zip: address.postalCode ?? p.zip,
    }))
  }

  const normalize = (value: string) => value.trim().toLowerCase()

  function getDuplicateApContactError() {
    const ordererEmail = normalize(form.orderer_email)
    const apEmail = normalize(form.ap_email)
    if (ordererEmail && apEmail && ordererEmail === apEmail) return 'AP contact MUST be different then the orderers contact'
    return null
  }

  function validateApContactDifference() {
    setApDuplicateError(getDuplicateApContactError())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const req = (msg: string) => ({ test: (v: string) => !!v?.trim(), message: msg })
    const rules = {
      company_name: [req('Company Name is required')],
      assigned_to: [req('Sales Consultant is required')],
      commissioned_client: [req('Commissioned Client is required')],
      tax_exempt: [{ test: (v: string) => v === 'yes' || v === 'no', message: 'Please select Yes or No' }],
      address1: [req('Address Line 1 is required')],
      city: [req('City is required')],
      state: [req('State is required')],
      zip: [req('ZIP is required')],
      phone: [req('Corporate Phone is required')],
      website: [req('Website is required')],
      orderer_first_name: [req('Orderer First Name is required')],
      orderer_last_name: [req('Orderer Last Name is required')],
      orderer_email: [req('Orderer Email is required')],
      ap_first_name: [req('AP Contact First Name is required')],
      ap_last_name: [req('AP Contact Last Name is required')],
      ap_email: [req('AP Contact Email is required')],
    }
    if (!validate(form, rules)) return

    const duplicateError = getDuplicateApContactError()
    if (duplicateError) {
      setApDuplicateError(duplicateError)
      return
    }
    if (form.tax_exempt === 'yes' && !taxCertificateFile) {
      setTaxCertificateError('Tax Certificate is required when Tax Exempt is Yes')
      return
    }

    setCreating(true)
    setCreateError(null)
    setTaxCertificateError(null)
    try {
      let taxCertificateUrl: string | null = null
      if (form.tax_exempt === 'yes' && taxCertificateFile) {
        const uploadForm = new FormData()
        uploadForm.append('file', taxCertificateFile)
        const uploadRes = await fetch('/api/marketing/upload', { method: 'POST', body: uploadForm })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) { setCreateError(uploadData.error ?? 'Tax certificate upload failed'); return }
        taxCertificateUrl = uploadData.url
      }

      const res = await fetch('/api/marketing/aturian-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: form.company_name.trim(),
          assigned_to: form.assigned_to || null,
          is_online_client: form.is_online_client,
          online_uses_cc: form.is_online_client ? form.online_uses_cc : null,
          commissioned_client: form.commissioned_client,
          tax_exempt: form.tax_exempt === 'yes',
          tax_certificate_url: taxCertificateUrl,
          address1: form.address1 || null,
          address2: form.address2 || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          phone: form.phone || null,
          website: form.website || null,
          orderer_first_name: form.orderer_first_name || null,
          orderer_last_name: form.orderer_last_name || null,
          orderer_email: form.orderer_email || null,
          ap_first_name: form.ap_first_name || null,
          ap_last_name: form.ap_last_name || null,
          ap_email: form.ap_email || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Submit failed'); return }

      router.push('/aturian/customers/queue')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <Link href="/aturian/customers/queue" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Customer Queue
      </Link>
      <h1 className="text-xl font-bold text-slate-900 mb-1">Add Customer — Aturian</h1>
      <p className="text-sm text-slate-500 mb-4">Submits a request for Amy or Jill to create this customer in Aturian.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {createError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createError}</div>}

        {/* Company Info */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-visible">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Company Information</h2>
            <PlacesAddressAutocomplete 
              initialQuery={form.company_name} 
              onAddressSelect={applyAddress}
              onPlaceSelect={(place) => {
                if (place.name) {
                  setForm((p) => ({ ...p, company_name: place.name }))
                  clearError('company_name')
                }
              }}
            />
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-4">
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Company Name</label>
              <input type="text" value={form.company_name}
                onChange={(e) => { setForm((p) => ({ ...p, company_name: e.target.value })); clearError('company_name') }}
                className={inputCls(errors.company_name)} />
              <FieldError error={errors.company_name} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Sales Consultant</label>
              <select value={form.assigned_to}
                onChange={(e) => { setForm((p) => ({ ...p, assigned_to: e.target.value })); clearError('assigned_to') }}
                className={selectCls(errors.assigned_to)}>
                <option value="">— Unassigned —</option>
                {crmUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.display_name}</option>
                ))}
              </select>
              <FieldError error={errors.assigned_to} />
            </div>
            <div className="col-span-3 flex items-center gap-2 pt-1">
              <input type="checkbox" id="is_online_client" checked={form.is_online_client}
                onChange={(e) => setForm((p) => ({ ...p, is_online_client: e.target.checked, online_uses_cc: e.target.checked ? p.online_uses_cc : false }))}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-400" />
              <label htmlFor="is_online_client" className="text-sm text-slate-700 cursor-pointer">Online Client?</label>
            </div>
            {form.is_online_client && (
              <div className="col-span-3 flex items-center gap-2 pl-6">
                <input type="checkbox" id="online_uses_cc" checked={form.online_uses_cc}
                  onChange={(e) => setForm((p) => ({ ...p, online_uses_cc: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-400" />
                <label htmlFor="online_uses_cc" className="text-sm text-slate-700 cursor-pointer">Will this store use a CC?</label>
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Commissioned Client</label>
              <select value={form.commissioned_client}
                onChange={(e) => { setForm((p) => ({ ...p, commissioned_client: e.target.value })); clearError('commissioned_client') }}
                className={selectCls(errors.commissioned_client)}>
                <option value="">— Select —</option>
                {COMMISSIONED_CLIENT_OPTIONS.map((opt) => <option key={opt}>{opt}</option>)}
              </select>
              <FieldError error={errors.commissioned_client} />
            </div>
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Tax Exempt</label>
              <p className="mt-0.5 mb-2 text-xs text-slate-400">Select Yes only when customer has current exemption paperwork. A tax certificate must be uploaded and will be saved to related files as &quot;Tax Certificate&quot;.</p>
              <div className="flex gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="tax_exempt" value="yes"
                    checked={form.tax_exempt === 'yes'}
                    onChange={() => { setForm((p) => ({ ...p, tax_exempt: 'yes' })); clearError('tax_exempt') }}
                    className="w-4 h-4 border-slate-300 text-purple-600 focus:ring-purple-400" />
                  <span className="text-sm text-slate-700">Yes</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="tax_exempt" value="no"
                    checked={form.tax_exempt === 'no'}
                    onChange={() => { setForm((p) => ({ ...p, tax_exempt: 'no' })); setTaxCertificateFile(null); setTaxCertificateError(null); clearError('tax_exempt') }}
                    className="w-4 h-4 border-slate-300 text-purple-600 focus:ring-purple-400" />
                  <span className="text-sm text-slate-700">No</span>
                </label>
              </div>
              <FieldError error={errors.tax_exempt} />
            </div>
            {form.tax_exempt === 'yes' && (
              <div className="col-span-3">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Tax Certificate</label>
                <input
                  type="file"
                  required
                  onChange={(e) => { setTaxCertificateFile(e.target.files?.[0] ?? null); setTaxCertificateError(null) }}
                  className={`block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-purple-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-purple-700 hover:file:bg-purple-100 ${taxCertificateError ? 'text-red-700' : ''}`}
                />
                {taxCertificateError && <p className="mt-1 text-xs text-red-600">{taxCertificateError}</p>}
                <p className="mt-1 text-xs text-slate-400">Upload customer exemption certificate. It will appear in related files as Tax Certificate.</p>
              </div>
            )}
          </div>
        </div>

        {/* Corporate Address */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-visible">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Corporate Address</h2>
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-4">
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Address Line 1</label>
              <input type="text" value={form.address1}
                onChange={(e) => { setForm((p) => ({ ...p, address1: e.target.value })); clearError('address1') }}
                className={inputCls(errors.address1)} />
              <FieldError error={errors.address1} />
            </div>
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Address Line 2</label>
              <input type="text" value={form.address2}
                onChange={(e) => setForm((p) => ({ ...p, address2: e.target.value }))}
                className={inputCls()} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">City</label>
              <input type="text" value={form.city}
                onChange={(e) => { setForm((p) => ({ ...p, city: e.target.value })); clearError('city') }}
                className={inputCls(errors.city)} />
              <FieldError error={errors.city} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">State</label>
              <input type="text" value={form.state}
                onChange={(e) => { setForm((p) => ({ ...p, state: e.target.value })); clearError('state') }}
                className={inputCls(errors.state)} />
              <FieldError error={errors.state} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">ZIP</label>
              <input type="text" value={form.zip}
                onChange={(e) => { setForm((p) => ({ ...p, zip: e.target.value })); clearError('zip') }}
                className={inputCls(errors.zip)} />
              <FieldError error={errors.zip} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Corporate Phone</label>
              <input type="tel" value={form.phone}
                onChange={(e) => { setForm((p) => ({ ...p, phone: formatPhoneInput(e.target.value) })); clearError('phone') }}
                className={inputCls(errors.phone)} />
              <FieldError error={errors.phone} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Website</label>
              <input type="url" value={form.website}
                onChange={(e) => { setForm((p) => ({ ...p, website: e.target.value })); clearError('website') }}
                className={inputCls(errors.website)} />
              <FieldError error={errors.website} />
            </div>
          </div>
        </div>

        {/* Main/Ordering Contact */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Main / Ordering Contact</h2>
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">First Name</label>
              <input type="text" value={form.orderer_first_name}
                onChange={(e) => { setForm((p) => ({ ...p, orderer_first_name: e.target.value })); clearError('orderer_first_name') }}
                className={inputCls(errors.orderer_first_name)} />
              <FieldError error={errors.orderer_first_name} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Last Name</label>
              <input type="text" value={form.orderer_last_name}
                onChange={(e) => { setForm((p) => ({ ...p, orderer_last_name: e.target.value })); clearError('orderer_last_name') }}
                className={inputCls(errors.orderer_last_name)} />
              <FieldError error={errors.orderer_last_name} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Email</label>
              <input type="email" value={form.orderer_email}
                onChange={(e) => { setForm((p) => ({ ...p, orderer_email: e.target.value })); clearError('orderer_email'); setApDuplicateError(null) }}
                onBlur={validateApContactDifference}
                className={inputCls(errors.orderer_email)} />
              <FieldError error={errors.orderer_email} />
            </div>
          </div>
        </div>

        {/* AP Contact */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">AP Contact</h2>
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">First Name</label>
              <input type="text" value={form.ap_first_name}
                onChange={(e) => { setForm((p) => ({ ...p, ap_first_name: e.target.value })); clearError('ap_first_name') }}
                className={inputCls(errors.ap_first_name)} />
              <FieldError error={errors.ap_first_name} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Last Name</label>
              <input type="text" value={form.ap_last_name}
                onChange={(e) => { setForm((p) => ({ ...p, ap_last_name: e.target.value })); clearError('ap_last_name') }}
                className={inputCls(errors.ap_last_name)} />
              <FieldError error={errors.ap_last_name} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Email</label>
              <input type="email" value={form.ap_email}
                onChange={(e) => { setForm((p) => ({ ...p, ap_email: e.target.value })); clearError('ap_email'); setApDuplicateError(null) }}
                onBlur={validateApContactDifference}
                className={inputCls(errors.ap_email ?? apDuplicateError ?? undefined)} />
              <FieldError error={errors.ap_email ?? apDuplicateError ?? undefined} />
            </div>
            <p className="text-xs text-slate-400 italic col-span-3">AP contact MUST be different than the orderer&apos;s contact.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={creating}
            className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors">
            {creating ? 'Submitting…' : 'Submit Request'}
          </button>
          <Link href="/aturian/customers/queue" className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
