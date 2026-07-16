'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { AturianCustomerQueueEntry, AturianQueueStatus } from '@/types'

type QueueRow = AturianCustomerQueueEntry & {
  assigned_user: { id: string; display_name: string } | null
  claimed_user: { id: string; display_name: string } | null
  created_by_user: { id: string; display_name: string } | null
}

const QUEUE_STATUSES: Record<AturianQueueStatus, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-slate-100 text-slate-600' },
  claimed: { label: 'Claimed', cls: 'bg-blue-100 text-blue-700' },
  complete: { label: 'Complete', cls: 'bg-green-100 text-green-700' },
}

function statusBadge(status: AturianQueueStatus) {
  const s = QUEUE_STATUSES[status]
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>
}

export default function AturianCustomerQueuePage() {
  const [entries, setEntries] = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<AturianQueueStatus | 'all'>('all')

  useEffect(() => {
    const params = filter === 'all' ? '' : `?status=${filter}`
    setLoading(true)
    fetch(`/api/marketing/aturian-queue${params}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []))
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <div className="px-6 py-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Aturian Customer Queue</h1>
          <p className="text-sm text-slate-500 mt-0.5">Requests waiting to be added to Aturian.</p>
        </div>
        <Link href="/aturian/customers/new" className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl transition-colors">
          + Add Customer
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {(['all', 'new', 'claimed', 'complete'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filter === f ? 'bg-purple-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? 'All' : QUEUE_STATUSES[f].label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-2.5">Company</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Sales Consultant</th>
              <th className="px-4 py-2.5">Claimed By</th>
              <th className="px-4 py-2.5">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Loading…</td></tr>
            )}
            {!loading && entries.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No queue entries.</td></tr>
            )}
            {!loading && entries.map((entry) => (
              <tr key={entry.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/aturian/customers/queue/${entry.id}`} className="font-medium text-purple-700 hover:underline">
                    {entry.company_name}
                  </Link>
                </td>
                <td className="px-4 py-2.5">{statusBadge(entry.status)}</td>
                <td className="px-4 py-2.5 text-slate-600">{entry.assigned_user?.display_name ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-600">{entry.claimed_user?.display_name ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-500">{new Date(entry.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
