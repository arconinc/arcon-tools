'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PlacesAddressAutocomplete } from '@/components/crm/PlacesAddressAutocomplete'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatPhoneInput, isValidPhone } from '@/lib/phone'
import { useFormValidation, inputCls, selectCls, isValidEmail, FieldError } from '@/lib/form-validation'
import { useAppUser } from '@/components/layout/AppShell'
import { useApiResource } from '@/hooks/useApiResource'
import type { CrmUserLite } from '@/hooks/useCrmUsers'
import type { PlacesAddress } from '@/lib/google-places'

type CreateForm = {
  requestor_id: string
  company_name: string
  phone: string
  website: string
  mailing_address1: string
  mailing_address2: string
  mailing_city: string
  mailing_state: string
  mailing_zip: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
  orders_email: string
  ap_email: string
  art_email: string
  sales_rep: string
  paperwork_notes: string
}

const EMPTY_FORM: CreateForm = {
  requestor_id: '', company_name: '', phone: '', website: '',
  mailing_address1: '', mailing_address2: '', mailing_city: '', mailing_state: '', mailing_zip: '',
  address1: '', address2: '', city: '', state: '', zip: '',
  orders_email: '', ap_email: '', art_email: '', sales_rep: '', paperwork_notes: '',
}

export default function AturianAddSupplierPage() {
  const router = useRouter()
  const { user } = useAppUser()
  const { data: crmUsers } = useApiResource<CrmUserLite[]>('/api/marketing/access-groups/customer_supplier_creator/users')

  const [form, setForm] = useState<CreateForm>(() => ({ ...EMPTY_FORM, requestor_id: user?.id ?? '' }))
  const { errors, validate, clearError } = useFormValidation<CreateForm>()
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [paperworkFile, setPaperworkFile] = useState<{ path: string; name: string } | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  function applyMailingAddress(address: PlacesAddress) {
    setForm((p) => ({
      ...p,
      mailing_address1: address.address1 ?? p.mailing_address1,
      mailing_address2: address.address2 ?? p.mailing_address2,
      mailing_city: address.city ?? p.mailing_city,
      mailing_state: address.state ?? p.mailing_state,
      mailing_zip: address.postalCode ?? p.mailing_zip,
    }))
    clearError('mailing_address1'); clearError('mailing_city'); clearError('mailing_state'); clearError('mailing_zip')
  }

  function applyBillingAddress(address: PlacesAddress) {
    setForm((p) => ({
      ...p,
      address1: address.address1 ?? p.address1,
      address2: address.address2 ?? p.address2,
      city: address.city ?? p.city,
      state: address.state ?? p.state,
      zip: address.postalCode ?? p.zip,
    }))
    clearError('address1'); clearError('city'); clearError('state'); clearError('zip')
  }

  function copyMailingToBilling() {
    setForm((p) => ({
      ...p,
      address1: p.mailing_address1,
      address2: p.mailing_address2,
      city: p.mailing_city,
      state: p.mailing_state,
      zip: p.mailing_zip,
    }))
    clearError('address1'); clearError('city'); clearError('state'); clearError('zip')
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploadingFile(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/marketing/aturian-supplier-queue/upload', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) { setUploadError(data.error ?? 'Upload failed'); return }
      setPaperworkFile({ path: data.path, name: data.name })
    } finally {
      setUploadingFile(false)
      e.target.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const req = (msg: string) => ({ test: (v: string) => !!v?.trim(), message: msg })
    const email = (msg: string) => ({ test: (v: string) => isValidEmail(v), message: msg })
    const phone = (msg: string) => ({ test: (v: string) => isValidPhone(v), message: msg })
    const rules = {
      requestor_id: [req('Requestor is required')],
      company_name: [req('Full Supplier Company Name is required')],
      mailing_address1: [req('Supplier Mailing Address is required')],
      mailing_city: [req('Supplier Mailing City is required')],
      mailing_state: [req('Supplier Mailing State is required')],
      mailing_zip: [req('Supplier Mailing ZIP is required')],
      phone: [req('Phone is required'), phone('Enter a valid 10-digit phone number')],
      address1: [req('Billing Address Line 1 is required')],
      city: [req('Billing City is required')],
      state: [req('Billing State is required')],
      zip: [req('Billing ZIP is required')],
      website: [req('Website is required')],
      orders_email: [req('Orders Email is required'), email('Enter a valid email address')],
      ap_email: [req('AP Email is required'), email('Enter a valid email address')],
      art_email: [req('Art Email is required'), email('Enter a valid email address')],
      sales_rep: [req('Sales Rep Name and Email is required')],
      paperwork_notes: [req('Paperwork notes are required')],
    }
    if (!validate(form, rules)) return

    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/marketing/aturian-supplier-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestor_id: form.requestor_id,
          company_name: form.company_name.trim(),
          phone: form.phone,
          website: form.website,
          mailing_address1: form.mailing_address1,
          mailing_address2: form.mailing_address2 || null,
          mailing_city: form.mailing_city,
          mailing_state: form.mailing_state,
          mailing_zip: form.mailing_zip,
          address1: form.address1,
          address2: form.address2 || null,
          city: form.city,
          state: form.state,
          zip: form.zip,
          orders_email: form.orders_email,
          ap_email: form.ap_email,
          art_email: form.art_email,
          sales_rep: form.sales_rep,
          paperwork_notes: form.paperwork_notes,
          paperwork_file_path: paperworkFile?.path ?? null,
          paperwork_file_name: paperworkFile?.name ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Submit failed'); return }

      router.push('/aturian/suppliers/queue')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <PageHeader title="Add Supplier" subtitle="Submit a request for Jill or Amy to create this supplier in Aturian" bg="/aturian_bg.png" />

      <div className="w-full px-6 py-6">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-4">
        {createError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createError}</div>}

        {/* Company Info */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-visible">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Company Information</h2>
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-4">
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Requestor</label>
              <select value={form.requestor_id}
                onChange={(e) => { setForm((p) => ({ ...p, requestor_id: e.target.value })); clearError('requestor_id') }}
                className={selectCls(errors.requestor_id)}>
                <option value="">Select a person...</option>
                {crmUsers?.map((u) => (
                  <option key={u.id} value={u.id}>{u.display_name ?? u.email}</option>
                ))}
              </select>
              <FieldError error={errors.requestor_id} />
              <p className="mt-0.5 text-xs text-slate-400">So we can email you once the vendor has been added.</p>
            </div>
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Full Supplier Company Name</label>
              <input type="text" value={form.company_name}
                onChange={(e) => { setForm((p) => ({ ...p, company_name: e.target.value })); clearError('company_name') }}
                className={inputCls(errors.company_name)} />
              <FieldError error={errors.company_name} />
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-visible">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Mailing Address</h2>
            <PlacesAddressAutocomplete initialQuery={form.company_name} onAddressSelect={applyMailingAddress} />
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-4">
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Address Line 1</label>
              <input type="text" value={form.mailing_address1}
                onChange={(e) => { setForm((p) => ({ ...p, mailing_address1: e.target.value })); clearError('mailing_address1') }}
                className={inputCls(errors.mailing_address1)} />
              <FieldError error={errors.mailing_address1} />
            </div>
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Address Line 2</label>
              <input type="text" value={form.mailing_address2}
                onChange={(e) => setForm((p) => ({ ...p, mailing_address2: e.target.value }))}
                className={inputCls()} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">City</label>
              <input type="text" value={form.mailing_city}
                onChange={(e) => { setForm((p) => ({ ...p, mailing_city: e.target.value })); clearError('mailing_city') }}
                className={inputCls(errors.mailing_city)} />
              <FieldError error={errors.mailing_city} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">State</label>
              <input type="text" value={form.mailing_state}
                onChange={(e) => { setForm((p) => ({ ...p, mailing_state: e.target.value })); clearError('mailing_state') }}
                className={inputCls(errors.mailing_state)} />
              <FieldError error={errors.mailing_state} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">ZIP</label>
              <input type="text" value={form.mailing_zip}
                onChange={(e) => { setForm((p) => ({ ...p, mailing_zip: e.target.value })); clearError('mailing_zip') }}
                className={inputCls(errors.mailing_zip)} />
              <FieldError error={errors.mailing_zip} />
            </div>
          </div>

          <div className="px-5 pb-2">
            <button type="button" onClick={copyMailingToBilling}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700">
              Copy mailing address to billing ↓
            </button>
          </div>

          <div className="px-5 py-3 bg-slate-50 border-y border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Billing Address (where checks are mailed)</h2>
            <PlacesAddressAutocomplete initialQuery={form.company_name} onAddressSelect={applyBillingAddress} />
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
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</label>
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

        {/* Emails */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Contact Emails</h2>
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Orders Email</label>
              <input type="email" value={form.orders_email}
                onChange={(e) => { setForm((p) => ({ ...p, orders_email: e.target.value })); clearError('orders_email') }}
                className={inputCls(errors.orders_email)} />
              <FieldError error={errors.orders_email} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">AP Email</label>
              <input type="email" value={form.ap_email}
                onChange={(e) => { setForm((p) => ({ ...p, ap_email: e.target.value })); clearError('ap_email') }}
                className={inputCls(errors.ap_email)} />
              <FieldError error={errors.ap_email} />
              <p className="mt-0.5 text-xs text-slate-400">For accounting questions.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Art Email</label>
              <input type="email" value={form.art_email}
                onChange={(e) => { setForm((p) => ({ ...p, art_email: e.target.value })); clearError('art_email') }}
                className={inputCls(errors.art_email)} />
              <FieldError error={errors.art_email} />
              <p className="mt-0.5 text-xs text-slate-400">Where artwork is emailed.</p>
            </div>
          </div>
        </div>

        {/* Sales Rep + Terms */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Sales Rep &amp; Terms</h2>
          </div>
          <div className="px-5 py-4 grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Inside or Outside Sales Rep Name and Email</label>
              <input type="text" value={form.sales_rep}
                onChange={(e) => { setForm((p) => ({ ...p, sales_rep: e.target.value })); clearError('sales_rep') }}
                className={inputCls(errors.sales_rep)} />
              <FieldError error={errors.sales_rep} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Paperwork Needed to Establish Terms</label>
              <textarea rows={3} value={form.paperwork_notes}
                onChange={(e) => { setForm((p) => ({ ...p, paperwork_notes: e.target.value })); clearError('paperwork_notes') }}
                className={inputCls(errors.paperwork_notes)} placeholder="Describe any paperwork required to establish terms with this supplier" />
              <FieldError error={errors.paperwork_notes} />

              <div className="mt-2">
                {paperworkFile ? (
                  <div className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="truncate flex-1">{paperworkFile.name}</span>
                    <button type="button" onClick={() => setPaperworkFile(null)} className="text-slate-400 hover:text-red-600 text-xs font-semibold">Remove</button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700 cursor-pointer">
                    {uploadingFile ? 'Uploading…' : 'Attach paperwork file'}
                    <input type="file" className="hidden" onChange={handleFileChange} disabled={uploadingFile} />
                  </label>
                )}
                {uploadError && <p className="mt-1 text-xs text-red-600 font-medium">{uploadError}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={creating}
            className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors">
            {creating ? 'Submitting…' : 'Submit Request'}
          </button>
          <Link href="/aturian/suppliers/queue" className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
      </div>
    </>
  )
}
