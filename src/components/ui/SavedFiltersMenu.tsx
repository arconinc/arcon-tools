'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppUser } from '@/components/layout/AppShell'

export interface SavedFilter {
  id: string
  user_id: string
  page_key: string
  name: string
  filter_config: Record<string, unknown>
  is_shared: boolean
  created_at: string
  updated_at: string
  users: { display_name: string; avatar_url: string | null } | null
}

interface Props {
  pageKey: string
  currentConfig: Record<string, unknown>
  onLoad: (config: Record<string, unknown>) => void
  /** Optional: current active filter name, used to track "dirty" state */
  activeFilterId?: string | null
  onActiveFilterIdChange?: (id: string | null) => void
}

export function SavedFiltersMenu({
  pageKey,
  currentConfig,
  onLoad,
  activeFilterId,
  onActiveFilterIdChange,
}: Props) {
  const { user } = useAppUser()
  const [filters, setFilters] = useState<SavedFilter[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveShared, setSaveShared] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const saveRef = useRef<HTMLDivElement>(null)

  const fetchFilters = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/saved-filters?page_key=${encodeURIComponent(pageKey)}`)
      if (res.ok) {
        const data = await res.json()
        setFilters(data)
      }
    } finally {
      setLoading(false)
    }
  }, [pageKey])

  useEffect(() => {
    fetchFilters()
  }, [fetchFilters])

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setDeleteConfirm(null)
      }
      if (saveRef.current && !saveRef.current.contains(e.target as Node)) {
        setSaveOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const activeFilter = activeFilterId ? filters.find(f => f.id === activeFilterId) : null

  // Check if current config differs from active filter
  const isDirty = activeFilter
    ? JSON.stringify(currentConfig) !== JSON.stringify(activeFilter.filter_config)
    : false

  const isOwner = (f: SavedFilter) => f.user_id === user?.id

  async function handleLoad(f: SavedFilter) {
    onLoad(f.filter_config)
    onActiveFilterIdChange?.(f.id)
    setOpen(false)
    setDeleteConfirm(null)
  }

  async function handleSaveNew() {
    if (!saveName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/saved-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_key: pageKey,
          name: saveName.trim(),
          filter_config: currentConfig,
          is_shared: saveShared,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setFilters(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        onActiveFilterIdChange?.(created.id)
        setSaveOpen(false)
        setSaveName('')
        setSaveShared(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleOverwrite() {
    if (!activeFilter || !isOwner(activeFilter)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/saved-filters/${activeFilter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter_config: currentConfig }),
      })
      if (res.ok) {
        const updated = await res.json()
        setFilters(prev => prev.map(f => f.id === updated.id ? updated : f))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/saved-filters/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setFilters(prev => prev.filter(f => f.id !== id))
      if (activeFilterId === id) onActiveFilterIdChange?.(null)
      setDeleteConfirm(null)
    }
  }

  const myFilters = filters.filter(f => f.user_id === user?.id)
  const sharedFilters = filters.filter(f => f.user_id !== user?.id && f.is_shared)

  return (
    <div className="flex items-center gap-2">
      {/* Active filter badge */}
      {activeFilter && (
        <span className="flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2.5 py-0.5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v3.172a2 2 0 01-.586 1.414l-4.828 4.828A2 2 0 0013 15.828V19l-4 2v-5.172a2 2 0 00-.586-1.414L4.586 9.586A2 2 0 014 8.172V7a2 2 0 012-2z" />
          </svg>
          {activeFilter.name}
          {isDirty && <span className="text-purple-400 ml-0.5">*</span>}
          <button
            onClick={() => onActiveFilterIdChange?.(null)}
            className="ml-0.5 text-purple-400 hover:text-purple-600"
            title="Clear saved filter"
          >
            ×
          </button>
        </span>
      )}

      {/* Overwrite button — only when dirty and owner */}
      {isDirty && activeFilter && isOwner(activeFilter) && (
        <button
          onClick={handleOverwrite}
          disabled={saving}
          className="text-xs text-purple-600 hover:text-purple-800 underline disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Update view'}
        </button>
      )}

      {/* Views dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => { setOpen(v => !v); setSaveOpen(false) }}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v3.172a2 2 0 01-.586 1.414l-4.828 4.828A2 2 0 0013 15.828V19l-4 2v-5.172a2 2 0 00-.586-1.414L4.586 9.586A2 2 0 014 8.172V7a2 2 0 012-2z" />
          </svg>
          Views
          {filters.length > 0 && (
            <span className="text-xs text-gray-400">({filters.length})</span>
          )}
          <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
            {loading ? (
              <div className="px-4 py-3 text-sm text-gray-400">Loading…</div>
            ) : filters.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-400">No saved views yet.</div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {myFilters.length > 0 && (
                  <>
                    <div className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">My Views</div>
                    {myFilters.map(f => (
                      <FilterRow
                        key={f.id}
                        filter={f}
                        isActive={f.id === activeFilterId}
                        isOwner
                        deleteConfirm={deleteConfirm}
                        onLoad={handleLoad}
                        onDeleteConfirm={setDeleteConfirm}
                        onDelete={handleDelete}
                      />
                    ))}
                  </>
                )}
                {sharedFilters.length > 0 && (
                  <>
                    <div className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Shared Views</div>
                    {sharedFilters.map(f => (
                      <FilterRow
                        key={f.id}
                        filter={f}
                        isActive={f.id === activeFilterId}
                        isOwner={false}
                        deleteConfirm={deleteConfirm}
                        onLoad={handleLoad}
                        onDeleteConfirm={setDeleteConfirm}
                        onDelete={handleDelete}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save view button */}
      <div className="relative" ref={saveRef}>
        <button
          onClick={() => { setSaveOpen(v => !v); setOpen(false); setSaveName('') }}
          className="flex items-center gap-1.5 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-lg px-3 py-1.5 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Save view
        </button>

        {saveOpen && (
          <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4">
            <p className="text-sm font-semibold text-gray-800 mb-3">Save current filters as view</p>
            <input
              type="text"
              placeholder="View name (e.g. Dream Team)"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveNew()}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              autoFocus
            />
            <label className="flex items-center gap-2 text-sm text-gray-600 mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveShared}
                onChange={e => setSaveShared(e.target.checked)}
                className="w-4 h-4 accent-purple-600 rounded"
              />
              Share with everyone
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleSaveNew}
                disabled={!saveName.trim() || saving}
                className="flex-1 text-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg px-3 py-2 transition-colors"
              >
                {saving ? 'Saving…' : 'Save view'}
              </button>
              <button
                onClick={() => setSaveOpen(false)}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Filter Row ───────────────────────────────────────────────────────────────

interface FilterRowProps {
  filter: SavedFilter
  isActive: boolean
  isOwner: boolean
  deleteConfirm: string | null
  onLoad: (f: SavedFilter) => void
  onDeleteConfirm: (id: string | null) => void
  onDelete: (id: string) => void
}

function FilterRow({ filter, isActive, isOwner, deleteConfirm, onLoad, onDeleteConfirm, onDelete }: FilterRowProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 group ${isActive ? 'bg-purple-50' : ''}`}
    >
      <button
        onClick={() => onLoad(filter)}
        className="flex-1 text-left flex items-center gap-2 min-w-0"
      >
        <span className={`text-sm truncate ${isActive ? 'font-semibold text-purple-700' : 'text-gray-700'}`}>
          {filter.name}
        </span>
        {filter.is_shared && (
          <span title="Shared with everyone">
            <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
        )}
        {!isOwner && filter.users && (
          <span className="text-xs text-gray-400 truncate flex-shrink-0">
            {filter.users.display_name.split(' ')[0]}
          </span>
        )}
      </button>
      {isOwner && (
        deleteConfirm === filter.id ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onDelete(filter.id)}
              className="text-xs text-red-600 hover:text-red-800 font-medium"
            >
              Delete
            </button>
            <button
              onClick={() => onDeleteConfirm(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            onClick={() => onDeleteConfirm(filter.id)}
            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity flex-shrink-0"
            title="Delete view"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )
      )}
    </div>
  )
}
