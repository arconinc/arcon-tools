'use client'

import { useState, useEffect, useCallback } from 'react'
import { AuditLog } from '@/types'

export default function AuditLogPage() {
  const [records, setRecords] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageSize = 50

  const loadLogs = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/audit-log?page=${page}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? 'Failed to load audit log')
      return
    }
    setRecords(data.records ?? [])
    setTotal(data.total ?? 0)
  }, [page])

  useEffect(() => { loadLogs() }, [loadLogs])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500 mt-1">All actions performed via this dashboard. {total > 0 && `${total} total entries.`}</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 mb-4">{error}</div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className="px-4 py-3 font-medium text-slate-500">When</th>
              <th className="px-4 py-3 font-medium text-slate-500">User</th>
              <th className="px-4 py-3 font-medium text-slate-500">Action</th>
              <th className="px-4 py-3 font-medium text-slate-500">Store / Order</th>
              <th className="px-4 py-3 font-medium text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading && (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-24" /></td>
                  <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-32" /></td>
                  <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-28" /></td>
                  <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-20" /></td>
                  <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-16" /></td>
                </tr>
              ))
            )}
            {!loading && records.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {log.users?.display_name ?? log.user_id}
                  {log.users?.email && (
                    <div className="text-xs text-slate-400">{log.users.email}</div>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{log.action}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {log.store_id && <div>Store: {log.store_id}</div>}
                  {log.order_id && <div>Order: #{log.order_id}</div>}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={log.status} />
                </td>
              </tr>
            ))}
            {!loading && records.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">No audit log entries yet.</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {total > pageSize && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * pageSize >= total}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    success: 'bg-emerald-100 text-emerald-700',
    error: 'bg-red-100 text-red-700',
    partial: 'bg-amber-100 text-amber-700',
  }[status] ?? 'bg-slate-100 text-slate-600'

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles}`}>{status}</span>
  )
}
