'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PlacesAddressAutocomplete } from '@/components/crm/PlacesAddressAutocomplete'
import { formatPhoneInput } from '@/lib/phone'
import { useFormValidation, inputCls, FieldError } from '@/lib/form-validation'
import type { PlacesAddress } from '@/lib/google-places'

type CreateForm = {
  company_name: string
  phone: string
  website: string
  product_line: string
  specialty: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
  orders_email: string
  ap_email: string
}

const EMPTY_FORM: CreateForm = {
  company_name: '', phone: '', website: '', product_line: '', specialty: '',
  address1: '', address2: '', city: '', state: '', zip: '',
  orders_email: '', ap_email: '',
}

export default function AturianAddSupplierPage() {
  const router = useRouter()

  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const { errors, validate, clearError } = useFormValidation<CreateForm>()
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const req = (msg: string) => ({ test: (v: string) => !!v?.trim(), message: msg })
    const rules = {
      company_name: [req('Company Name is required')],
      phone: [req('Phone is required')],
      address1: [req('Billing Address Line 1 is required')],
      city: [req('Billing City is required')],
      state: [req('Billing State is required')],
      zip: [req('Billing ZIP is required')],
      orders_email: [req('Orders Email is required')],
      ap_email: [req('AP Email is required')],
    }
    if (!validate(form, rules)) return

    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/marketing/aturian-supplier-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: form.company_name.trim(),
          phone: form.phone || null,
          website: form.website || null,
          product_line: form.product_line || null,
          specialty: form.specialty || null,
          address1: form.address1 || null,
          address2: form.address2 || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          orders_email: form.orders_email || null,
          ap_email: form.ap_email || null,
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
    <div className="max-w-4xl mx-auto px-6 py-6">
      <Link href="/aturian/suppliers/queue" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Supplier Queue
      </Link>
      <h1 className="text-xl font-bold text-slate-900 mb-1">Add Supplier — Aturian</h1>
      <p className="text-sm text-slate-500 mb-4">Submits a request for Jill or Amy to create this supplier in Aturian.</p>

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
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Product Line</label>
              <input type="text" value={form.product_line}
                onChange={(e) => setForm((p) => ({ ...p, product_line: e.target.value }))}
                className={inputCls()} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Specialty</label>
              <input type="text" value={form.specialty}
                onChange={(e) => setForm((p) => ({ ...p, specialty: e.target.value }))}
                className={inputCls()} />
            </div>
          </div>
        </div>

        {/* Billing Address */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-visible">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Billing Address</h2>
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
                onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                className={inputCls()} />
            </div>
          </div>
        </div>

        {/* Emails */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Contact Emails</h2>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 gap-4">
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
  )
}
