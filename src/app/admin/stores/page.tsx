'use client'

import { useState, useEffect, useCallback } from 'react'
import { Store } from '@/types'

export default function AdminStoresPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingStore, setEditingStore] = useState<Store | null>(null)
  const [formStoreId, setFormStoreId] = useState('')
  const [formStoreName, setFormStoreName] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadStores = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/stores')
    const data = await res.json()
    setLoading(false)
    if (Array.isArray(data)) setStores(data)
    else setError(data.error ?? 'Failed to load stores')
  }, [])

  useEffect(() => { loadStores() }, [loadStores])

  function openAddForm() {
    setEditingStore(null)
    setFormStoreId('')
    setFormStoreName('')
    setFormError(null)
    setShowForm(true)
  }

  function openEditForm(store: Store) {
    setEditingStore(store)
    setFormStoreId(store.store_id)
    setFormStoreName(store.store_name)
    setFormError(null)
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true)
    setFormError(null)

    const url = editingStore ? `/api/stores/${editingStore.id}` : '/api/stores'
    const method = editingStore ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_id: formStoreId, store_name: formStoreName, is_active: true }),
    })

    const data = await res.json()
    setFormLoading(false)

    if (!res.ok) {
      setFormError(data.error ?? 'Failed to save store')
      return
    }

    setShowForm(false)
    loadStores()
  }

  async function handleDelete(store: Store) {
    if (!confirm(`Delete "${store.store_name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/stores/${store.id}`, { method: 'DELETE' })
    if (res.ok) loadStores()
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stores</h1>
          <p className="text-sm text-slate-500 mt-1">Manage the PromoBullit stores available in this dashboard.</p>
        </div>
        <button
          onClick={openAddForm}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Store
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="font-semibold text-slate-800 mb-4">{editingStore ? 'Edit Store' : 'Add Store'}</h2>
            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
            )}
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">PromoBullit Store ID</label>
                <input
                  type="text"
                  value={formStoreId}
                  onChange={(e) => setFormStoreId(e.target.value)}
                  required
                  placeholder="e.g. 854"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">The numeric Store ID from the PromoBullit URL.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Store Name</label>
                <input
                  type="text"
                  value={formStoreName}
                  onChange={(e) => setFormStoreName(e.target.value)}
                  required
                  placeholder="e.g. Acme Corporate Store"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  {formLoading ? 'Saving…' : 'Save Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stores list */}
      {loading && <LoadingSkeleton />}
      {error && <ErrorBox message={error} />}

      {!loading && !error && stores.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-slate-500 text-sm">No stores configured yet. Click &ldquo;Add Store&rdquo; to get started.</p>
        </div>
      )}

      {stores.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
          {stores.map((store) => (
            <div key={store.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-medium text-slate-800">{store.store_name}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">Store ID: {store.store_id}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEditForm(store)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(store)}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
      {[1, 2, 3].map((n) => (
        <div key={n} className="px-5 py-4 animate-pulse">
          <div className="h-4 bg-slate-100 rounded w-1/3 mb-1.5" />
          <div className="h-3 bg-slate-100 rounded w-1/4" />
        </div>
      ))}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">{message}</div>
  )
}
