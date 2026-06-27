'use client'

import { useState, useEffect } from 'react'
import { PromoOrder, PromoOrderDetail, PromoOrderProduct, CARRIERS } from '@/types'
import { statusColor, todayISO } from './shared'

type Step = 'search' | 'detail' | 'success' | 'partial'

interface SuccessData {
  orderId: string
  customerEmail: string
  trackingNumber: string
  carrier: string
  emailSent: boolean
  partial?: boolean
  emailError?: string
}

// ── Step pill ─────────────────────────────────────────────────────────────────

function StepPill({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 ${active ? 'text-blue-600' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
        active ? 'bg-blue-600 text-white' : done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
      }`}>
        {done ? '✓' : n}
      </div>
      <span className="font-medium text-xs">{label}</span>
    </div>
  )
}

// ── Order Search ──────────────────────────────────────────────────────────────

function OrderSearch({ storeId, onSelect }: { storeId: string; onSelect: (o: PromoOrder) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PromoOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null); setSearched(true)
    const params = new URLSearchParams({ storeId, q: query })
    const res = await fetch(`/api/orders?${params}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Failed to fetch orders'); return }
    setResults(data.records ?? [])
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <h2 className="font-semibold text-slate-800 mb-4">Search for an Order</h2>
      <form onSubmit={handleSearch} className="flex gap-3 mb-5">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Order number, customer name, or company…"
          className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button type="submit" disabled={loading}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
          {loading ? (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          Search
        </button>
      </form>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">{error}</div>}
      {searched && !loading && results.length === 0 && !error && (
        <p className="text-sm text-slate-500 text-center py-6">No orders found matching your search.</p>
      )}
      {results.length > 0 && (
        <div className="divide-y divide-slate-100">
          {results.map(order => (
            <button key={order.id} onClick={() => onSelect(order)}
              className="w-full text-left py-3.5 hover:bg-slate-50 rounded-xl px-3 -mx-3 transition-colors group">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-sm font-semibold text-slate-800">#{order.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(order.status)}`}>{order.status}</span>
                  </div>
                  <p className="text-sm text-slate-600">{order.customerName}{order.companyName ? ` — ${order.companyName}` : ''}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{new Date(order.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${order.amount}</p>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
          {results.length === 100 && (
            <p className="text-xs text-slate-400 text-center pt-3">Showing first 100 results. Narrow your search to find a specific order.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tracking Form ─────────────────────────────────────────────────────────────

function TrackingForm({
  storeId, order, onSuccess, onBack,
}: {
  storeId: string; order: PromoOrder; onSuccess: (d: SuccessData) => void; onBack: () => void
}) {
  const [detail, setDetail] = useState<PromoOrderDetail | null>(null)
  const [products, setProducts] = useState<PromoOrderProduct[]>([])
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [carrierId, setCarrierId] = useState('Ups')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [shipmentDate, setShipmentDate] = useState(todayISO())
  const [sendEmail, setSendEmail] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    const carrier = CARRIERS.find(c => c.id === carrierId)
    if (carrier && carrier.trackingUrlTemplate && trackingNumber) {
      setTrackingUrl(carrier.trackingUrlTemplate.replace('{tracking}', trackingNumber))
    }
  }, [carrierId, trackingNumber])

  useEffect(() => {
    setLoadingDetail(true)
    fetch(`/api/orders/${order.id}?storeId=${storeId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setDetailError(data.error) }
        else { setDetail(data.detail); setProducts(data.products ?? []) }
        setLoadingDetail(false)
      })
      .catch(() => { setDetailError('Failed to load order details'); setLoadingDetail(false) })
  }, [order.id, storeId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmed) return
    setSubmitting(true); setSubmitError(null)

    const res = await fetch('/api/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId, orderId: order.id, carrierId, trackingNumber, trackingUrl, shipmentDate, sendEmail,
        customerName: detail ? `${detail.firstName} ${detail.lastName}` : order.customerName,
        customerEmail: detail?.billingEmail ?? '',
      }),
    })

    const data = await res.json()
    setSubmitting(false)

    if (res.status === 207) {
      onSuccess({ orderId: order.id, customerEmail: detail?.billingEmail ?? '', trackingNumber,
        carrier: CARRIERS.find(c => c.id === carrierId)?.name ?? carrierId, emailSent: false, partial: true, emailError: data.emailError })
      return
    }
    if (!res.ok) { setSubmitError(data.error ?? 'Failed to submit tracking'); return }
    onSuccess({ orderId: order.id, customerEmail: data.customerEmail, trackingNumber,
      carrier: CARRIERS.find(c => c.id === carrierId)?.name ?? carrierId, emailSent: sendEmail })
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to search
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Order #{order.id}</h2>
        {loadingDetail && <div className="animate-pulse space-y-2"><div className="h-4 bg-slate-100 rounded w-3/4" /><div className="h-4 bg-slate-100 rounded w-1/2" /></div>}
        {detailError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{detailError}</div>}
        {detail && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
            <div><span className="text-slate-500">Customer</span><p className="font-medium text-slate-800">{detail.firstName} {detail.lastName}</p></div>
            <div><span className="text-slate-500">Email</span><p className="font-medium text-slate-800">{detail.billingEmail}</p></div>
            <div><span className="text-slate-500">Status</span><p><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(detail.status)}`}>{detail.status}</span></p></div>
            <div><span className="text-slate-500">Order Total</span><p className="font-medium text-slate-800">${detail.amount}</p></div>
          </div>
        )}
        {products.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Line Items</p>
            <div className="space-y-1.5">
              {products.map(p => (
                <div key={p.id} className="flex justify-between text-sm py-1.5 border-t border-slate-100">
                  <div><span className="font-medium text-slate-800">{p.name}</span><span className="text-slate-400 ml-2 text-xs">SKU: {p.sku}</span></div>
                  <span className="text-slate-600">Qty: {p.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Enter Tracking Information</h2>
        <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-amber-800"><strong>Do not submit more than once.</strong> Each submission creates a new shipment record on this order.</p>
        </div>
        {submitError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{submitError}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Carrier</label>
              <select value={carrierId} onChange={e => setCarrierId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CARRIERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Shipment Date</label>
              <input type="date" value={shipmentDate} onChange={e => setShipmentDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tracking Number <span className="text-red-500">*</span></label>
            <input type="text" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} required
              placeholder="e.g. 1Z999AA10123456784"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tracking URL <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="url" value={trackingUrl} onChange={e => setTrackingUrl(e.target.value)}
              placeholder="https://…"
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-slate-400 mt-1">Auto-filled based on carrier and tracking number.</p>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Send notification email to customer</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {sendEmail
                    ? `An email with the tracking number will be sent to ${detail?.billingEmail ?? 'the customer'}.`
                    : 'No email will be sent. You can send it manually from PromoBullit if needed.'}
                </p>
              </div>
              <button type="button" role="switch" aria-checked={sendEmail} onClick={() => setSendEmail(v => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${sendEmail ? 'bg-blue-600' : 'bg-slate-300'}`}>
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${sendEmail ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
            <span className="text-sm text-slate-700">I confirm this shipment has not already been submitted for order <strong>#{order.id}</strong>.</span>
          </label>

          <button type="submit" disabled={submitting || !trackingNumber || !confirmed}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            {submitting ? (
              <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Submitting…</>
            ) : sendEmail ? 'Add Tracking & Send Email' : 'Add Tracking'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Result Screen ─────────────────────────────────────────────────────────────

function ResultScreen({ data, onReset }: { data: SuccessData; onReset: () => void }) {
  if (data.partial) {
    return (
      <div className="bg-white border border-amber-200 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Shipment Added — Email Failed</h2>
        <p className="text-slate-600 text-sm mb-1">Tracking number <strong>{data.trackingNumber}</strong> ({data.carrier}) was added to order <strong>#{data.orderId}</strong>.</p>
        <p className="text-sm text-red-600 mb-4">However, the notification email to <strong>{data.customerEmail}</strong> could not be sent.<br /><span className="text-xs text-slate-400">{data.emailError}</span></p>
        <p className="text-sm text-slate-500 mb-6">You may manually send the notification from the PromoBullit dashboard, or retry this order.</p>
        <button onClick={onReset} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">Add Tracking to Another Order</button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-emerald-200 rounded-2xl p-8 text-center">
      <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">{data.emailSent ? 'Tracking Added & Email Sent!' : 'Tracking Added!'}</h2>
      <p className="text-slate-600 text-sm mb-1">Tracking number <strong className="font-mono">{data.trackingNumber}</strong> ({data.carrier}) has been added to order <strong>#{data.orderId}</strong>.</p>
      <p className="text-sm text-slate-500 mb-6">
        {data.emailSent
          ? <><strong>{data.customerEmail}</strong> was notified by email.</>
          : 'No notification email was sent. You can send one manually from PromoBullit if needed.'}
      </p>
      <button onClick={onReset} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">Add Tracking to Another Order</button>
    </div>
  )
}

// ── Add Tracking Tab ──────────────────────────────────────────────────────────

export function AddTrackingTab({ storeId }: { storeId: string }) {
  const [step, setStep] = useState<Step>('search')
  const [selectedOrder, setSelectedOrder] = useState<PromoOrder | null>(null)
  const [successData, setSuccessData] = useState<SuccessData | null>(null)

  function handleReset() {
    setSelectedOrder(null); setSuccessData(null); setStep('search')
  }

  return (
    <div>
      {/* Step breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <StepPill n={1} label="Search" active={step === 'search'} done={step !== 'search'} />
        <div className="w-8 h-px bg-slate-200" />
        <StepPill n={2} label="Tracking" active={step === 'detail'} done={step === 'success' || step === 'partial'} />
        <div className="w-8 h-px bg-slate-200" />
        <StepPill n={3} label="Done" active={step === 'success' || step === 'partial'} done={false} />
      </div>

      {step === 'search' && (
        <OrderSearch storeId={storeId} onSelect={order => { setSelectedOrder(order); setStep('detail') }} />
      )}
      {step === 'detail' && selectedOrder && (
        <TrackingForm
          storeId={storeId}
          order={selectedOrder}
          onSuccess={data => { setSuccessData(data); setStep(data.partial ? 'partial' : 'success') }}
          onBack={() => setStep('search')}
        />
      )}
      {(step === 'success' || step === 'partial') && successData && (
        <ResultScreen data={successData} onReset={handleReset} />
      )}
    </div>
  )
}
