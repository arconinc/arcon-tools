'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ConfirmButton } from '@/components/ui/ConfirmButton'
import { buildAturianQueuePayload, sendAturianTransferPayload } from '@/lib/aturian-transfer'
import type { AturianCustomerQueueDetail } from '@/types'

export default function AturianCustomerQueueDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const [entry, setEntry] = useState<AturianCustomerQueueDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [aturianAssistSent, setAturianAssistSent] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/marketing/aturian-queue/${id}`)
      const data = await res.json()
      if (res.ok) setEntry(data)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function runAction(action: 'claim' | 'complete') {
    setActionError(null)
    const res = await fetch(`/api/marketing/aturian-queue/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    if (!res.ok) {
      setActionError(
        res.status === 403
          ? 'Only Amy, Jill, or an admin can claim or complete requests.'
          : (data.error ?? 'Action failed')
      )
      return
    }
    load()
  }

  function sendToAturianAssist() {
    if (!entry) return
    sendAturianTransferPayload(buildAturianQueuePayload(entry))
    setAturianAssistSent(true)
    window.setTimeout(() => setAturianAssistSent(false), 3500)
  }

  if (loading) {
    return (
      <div className="px-6 py-5">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-slate-100 rounded w-32" />
          <div className="h-24 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="px-6 py-5">
        <Link href="/aturian/customers/queue" className="text-sm text-slate-500 hover:text-slate-700">← Customer Queue</Link>
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">Queue entry not found</div>
      </div>
    )
  }

  const taxCertificate = entry.files.find((f) => f.label === 'Tax Certificate')

  return (
    <div className="px-6 py-5 max-w-3xl mx-auto">
      <Link href="/aturian/customers/queue" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Customer Queue
      </Link>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">{entry.company_name}</h1>
        <div className="flex items-center gap-2">
          {entry.status === 'new' && (
            <ConfirmButton idleLabel="Claim" variant="purple" onConfirm={() => runAction('claim')} />
          )}
          {entry.status !== 'new' && (
            <button
              onClick={sendToAturianAssist}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
            >
              Aturian Assist
            </button>
          )}
          {entry.status === 'claimed' && (
            <ConfirmButton idleLabel="Mark Complete" variant="green" onConfirm={() => runAction('complete')} />
          )}
        </div>
      </div>

      {aturianAssistSent && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
          Sent to Aturian Assist. Open Aturian, then use the Chrome extension to fill the current page.
        </div>
      )}
      {actionError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {actionError}
        </div>
      )}

      <div className="mb-4 p-3 rounded-xl border border-slate-200 bg-white flex items-center gap-3 text-sm">
        <span className="font-semibold text-slate-500">Status:</span>
        {entry.status === 'new' && <span className="text-slate-600">New — waiting to be claimed</span>}
        {entry.status === 'claimed' && <span className="text-blue-700">Claimed by {entry.claimed_user?.display_name ?? '—'}</span>}
        {entry.status === 'complete' && <span className="text-green-700">Complete</span>}
        <span className="text-slate-400 ml-auto">Requested by {entry.created_by_user?.display_name ?? '—'} on {new Date(entry.created_at).toLocaleDateString()}</span>
      </div>

      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Company Information</h2>
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-4 text-sm">
            <Field label="Sales Consultant" value={entry.assigned_user?.display_name} />
            <Field label="Online Client?" value={entry.is_online_client ? 'Yes' : 'No'} />
            {entry.is_online_client && <Field label="Uses CC?" value={entry.online_uses_cc ? 'Yes' : 'No'} />}
            <Field label="Commissioned Client" value={entry.commissioned_client} />
            <Field label="Tax Exempt" value={entry.tax_exempt ? 'Yes' : 'No'} />
            {taxCertificate && (
              <div className="col-span-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Tax Certificate</div>
                <a href={taxCertificate.url} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-700 hover:underline">
                  View Tax Certificate
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Corporate Address</h2>
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-4 text-sm">
            <Field label="Address Line 1" value={entry.address1} className="col-span-3" />
            {entry.address2 && <Field label="Address Line 2" value={entry.address2} className="col-span-3" />}
            <Field label="City" value={entry.city} />
            <Field label="State" value={entry.state} />
            <Field label="ZIP" value={entry.zip} />
            <Field label="Phone" value={entry.phone} />
            <Field label="Website" value={entry.website} className="col-span-2" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Main / Ordering Contact</h2>
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-4 text-sm">
            <Field label="First Name" value={entry.orderer_first_name} />
            <Field label="Last Name" value={entry.orderer_last_name} />
            <Field label="Email" value={entry.orderer_email} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">AP Contact</h2>
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-4 text-sm">
            <Field label="First Name" value={entry.ap_first_name} />
            <Field label="Last Name" value={entry.ap_last_name} />
            <Field label="Email" value={entry.ap_email} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, className = '' }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-slate-700">{value || '—'}</div>
    </div>
  )
}
