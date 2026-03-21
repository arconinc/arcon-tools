'use client'

import { useState, useEffect } from 'react'

type Tag = { id: string; name: string; color: string; created_at: string; usage_count?: number }

const PALETTE = [
  '#8b5cf6', '#3b82f6', '#22c55e', '#ef4444',
  '#f97316', '#06b6d4', '#ec4899', '#eab308',
  '#14b8a6', '#64748b', '#a855f7', '#0ea5e9',
]

function ColorDot({ color, size = 'md' }: { color: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={size === 'sm' ? 'w-3 h-3 rounded-full inline-block' : 'w-4 h-4 rounded-full inline-block'}
      style={{ backgroundColor: color }}
    />
  )
}

export default function CrmTagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // New tag form
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PALETTE[0])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    loadTags()
  }, [])

  async function loadTags() {
    setLoading(true)
    try {
      const res = await fetch('/api/crm/tags')
      const data = await res.json()
      if (Array.isArray(data)) setTags(data)
    } finally {
      setLoading(false)
    }
  }

  function startEdit(tag: Tag) {
    setEditId(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color)
  }

  function cancelEdit() {
    setEditId(null)
    setEditName('')
    setEditColor('')
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/tags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Save failed'); return }
      setTags((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)))
      cancelEdit()
    } finally {
      setSaving(false)
    }
  }

  async function deleteTag(id: string, name: string) {
    if (!confirm(`Delete tag "${name}"? This will remove it from all entities.`)) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/crm/tags/${id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); alert(d.error ?? 'Delete failed'); return }
      setTags((prev) => prev.filter((t) => t.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  async function createTag(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/crm/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Create failed'); return }
      setTags((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      setNewColor(PALETTE[0])
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">CRM Tags</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage tags shared across opportunities, customers, vendors, and contacts</p>
      </div>

      {/* Create new tag */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Create New Tag</h2>
        <form onSubmit={createTag} className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Tag Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Hot Lead, Partner, VIP…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Color</label>
            <div className="flex gap-1.5 flex-wrap max-w-[200px]">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${newColor === c ? 'ring-2 ring-offset-1 ring-slate-700 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
              <ColorDot color={newColor} />
              <span className="text-sm text-slate-700 font-medium">{newName || 'Preview'}</span>
            </div>
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
        {createError && (
          <p className="mt-2 text-sm text-red-600">{createError}</p>
        )}
      </div>

      {/* Tags list */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">All Tags</h2>
          <span className="text-xs text-slate-400">{tags.length} tag{tags.length !== 1 ? 's' : ''}</span>
        </div>

        {loading && (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-slate-100 animate-pulse" />
                <div className="h-4 bg-slate-100 rounded animate-pulse w-32" />
              </div>
            ))}
          </div>
        )}

        {!loading && tags.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            No tags yet. Create one above to get started.
          </div>
        )}

        {!loading && tags.length > 0 && (
          <div className="divide-y divide-slate-100">
            {tags.map((tag) => (
              <div key={tag.id} className="px-5 py-3 flex items-center gap-3">
                {editId === tag.id ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(tag.id); if (e.key === 'Escape') cancelEdit() }}
                      autoFocus
                      className="flex-1 px-2.5 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className={`w-5 h-5 rounded-full transition-transform ${editColor === c ? 'ring-2 ring-offset-1 ring-slate-700 scale-110' : 'hover:scale-105'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2 ml-auto">
                      <button
                        onClick={() => saveEdit(tag.id)}
                        disabled={saving}
                        className="px-3 py-1 text-xs font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-60 transition-colors"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 text-xs font-medium border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </span>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => startEdit(tag)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTag(tag.id, tag.name)}
                        disabled={deleting === tag.id}
                        className="px-2.5 py-1 text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
                      >
                        {deleting === tag.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
