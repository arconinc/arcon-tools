'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StoreDetail, Store } from '@/types'
import { formatDate } from './tabs/shared'
import { OverviewTab } from './tabs/OverviewTab'
import { TasksTab } from './tabs/TasksTab'
import { TeamTab } from './tabs/TeamTab'
import { CrmLinksTab } from './tabs/CrmLinksTab'
import { AddTrackingTab } from './tabs/AddTrackingTab'

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
      {label}
    </span>
  )
}

// ── Store selector (upper-right) ──────────────────────────────────────────────

function StoreSelector({ currentStoreId }: { currentStoreId: string }) {
  const router = useRouter()
  const [stores, setStores] = useState<Store[]>([])

  useEffect(() => {
    fetch('/api/stores').then(r => r.json()).then(d => { if (Array.isArray(d)) setStores(d) })
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    if (id && id !== currentStoreId) router.push(`/stores/${id}`)
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="w-2 h-2 rounded-full bg-green-500" />
      <select
        value={currentStoreId}
        onChange={handleChange}
        className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white hover:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
      >
        {stores.map(s => (
          <option key={s.id} value={s.id}>{s.store_name}</option>
        ))}
      </select>
    </div>
  )
}

// ── Tab definitions ───────────────────────────────────────────────────────────

type TabKey = 'overview' | 'tasks' | 'team' | 'crm' | 'tracking'

interface TabDef {
  key: TabKey
  label: string
  count?: number
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [store, setStore] = useState<StoreDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')

  const load = useCallback(async () => {
    const res = await fetch(`/api/stores/${id}`)
    if (!res.ok) { setError('Store not found'); setLoading(false); return }
    const d = await res.json()
    setStore(d)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-slate-100 rounded-xl w-1/3" />
        <div className="h-4 bg-slate-100 rounded w-1/4" />
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
    )
  }

  if (error || !store) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-red-600">{error ?? 'Store not found'}</p>
        <Link href="/stores" className="text-sm text-purple-600 hover:underline mt-2 inline-block">← Back to Stores</Link>
      </div>
    )
  }

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'tasks', label: 'Tasks', count: store.open_task_count || undefined },
    { key: 'team', label: 'Team', count: store.assignments.length || undefined },
    { key: 'crm', label: 'CRM Links' },
    { key: 'tracking', label: 'Add Tracking' },
  ]

  return (
    <>
      <style>{`
        .store-detail { max-width: 900px; margin: 0 auto; }
        .tab-bar { display: flex; gap: 4px; border-bottom: 1px solid #e2e8f0; margin-bottom: 24px; }
        .tab-btn { padding: 8px 16px 10px; font-size: 14px; font-weight: 500; color: #64748b; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.15s; white-space: nowrap; }
        .tab-btn:hover { color: #7c3aed; }
        .tab-btn.active { color: #7c3aed; border-bottom-color: #7c3aed; }
        .tab-count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; background: #f3e8ff; color: #7c3aed; border-radius: 999px; font-size: 10px; font-weight: 700; margin-left: 6px; padding: 0 4px; }
      `}</style>

      <div className="store-detail">
        {/* Back */}
        <Link href="/stores" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-purple-700 mb-4 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Stores
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{store.store_name}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {store.domain && (
                <span className="font-mono text-xs text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">{store.domain}</span>
              )}
              <StatusPill active={store.is_active} label={store.status} />
              {store.in_production && (
                <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">In Production</span>
              )}
              {store.store_id && (
                <span className="font-mono text-xs text-slate-400">ID: {store.store_id}</span>
              )}
              {store.store_id && (
                <a
                  href={`https://manage.promobullitstores.com/admin/v3/index.html#/store/dashboard/${store.store_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border border-slate-200 text-slate-600 bg-white hover:border-purple-400 hover:text-purple-700 hover:bg-purple-50 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Uducat
                </a>
              )}
              {store.domain && (
                <a
                  href={`https://${store.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border border-slate-200 text-slate-600 bg-white hover:border-purple-400 hover:text-purple-700 hover:bg-purple-50 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Storefront
                </a>
              )}
            </div>
            {(store.launch_date || store.takedown_date) && (
              <p className="text-xs text-slate-400 mt-1.5">
                {store.launch_date && <span>Launch: {formatDate(store.launch_date)}</span>}
                {store.launch_date && store.takedown_date && <span className="mx-1.5">·</span>}
                {store.takedown_date && <span>Ends: {formatDate(store.takedown_date)}</span>}
              </p>
            )}
            {/* Manager & Sales */}
            {store.assignments.length > 0 && (() => {
              const managers = store.assignments.filter(a => a.role === 'manager')
              const salesReps = store.assignments.filter(a => a.role === 'sales')
              return (
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  {managers.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Manager</span>
                      {managers.map(a => (
                        <span key={a.id} className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 bg-purple-50 border border-purple-200 rounded-full">
                          <span className="w-5 h-5 rounded-full bg-purple-200 text-purple-800 text-[9px] font-bold flex items-center justify-center shrink-0 overflow-hidden">
                            {a.user?.profile_image_url
                              ? <img src={a.user.profile_image_url} alt="" className="w-full h-full object-cover rounded-full" />
                              : (a.user?.display_name?.[0] ?? '?')}
                          </span>
                          <span className="text-xs font-medium text-purple-800">{a.user?.display_name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {salesReps.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Sales</span>
                      {salesReps.map(a => (
                        <span key={a.id} className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 bg-blue-50 border border-blue-200 rounded-full">
                          <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 text-[9px] font-bold flex items-center justify-center shrink-0 overflow-hidden">
                            {a.user?.profile_image_url
                              ? <img src={a.user.profile_image_url} alt="" className="w-full h-full object-cover rounded-full" />
                              : (a.user?.display_name?.[0] ?? '?')}
                          </span>
                          <span className="text-xs font-medium text-blue-800">{a.user?.display_name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Store selector */}
          <StoreSelector currentStoreId={store.id} />
        </div>

        {/* Tab bar */}
        <div className="tab-bar">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`tab-btn ${tab === t.key ? 'active' : ''}`}>
              {t.label}
              {t.count !== undefined && <span className="tab-count">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          {tab === 'overview' && <OverviewTab store={store} onSaved={load} />}
          {tab === 'tasks' && <TasksTab storeId={store.id} />}
          {tab === 'team' && <TeamTab store={store} />}
          {tab === 'crm' && <CrmLinksTab store={store} onSaved={load} />}
          {tab === 'tracking' && <AddTrackingTab storeId={store.store_id} />}
        </div>
      </div>
    </>
  )
}
