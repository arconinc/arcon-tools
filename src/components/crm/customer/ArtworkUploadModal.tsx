'use client'

import { useState } from 'react'
import type { ArtworkItem } from '@/hooks/useArtwork'

type Props = {
  open: boolean
  customerId: string
  onClose: () => void
  onAdded: (item: ArtworkItem) => void
}

export function ArtworkUploadModal({ open, customerId, onClose, onAdded }: Props) {
  const [mode, setMode] = useState<'upload' | 'drive' | 'dropbox'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [driveUrl, setDriveUrl] = useState('')
  const [dropboxUrl, setDropboxUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  function reset() {
    setMode('upload')
    setFile(null)
    setName('')
    setDesc('')
    setDriveUrl('')
    setDropboxUrl('')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setUploading(true)
    setError(null)
    try {
      let payload: Record<string, unknown> = {
        customer_id: customerId,
        name,
        description: desc || null,
        is_drive_link: mode === 'drive',
      }

      if (mode === 'upload' && file) {
        const form = new FormData()
        form.append('file', file)
        form.append('customer_id', customerId)
        const uploadRes = await fetch('/api/marketing/artwork/upload', { method: 'POST', body: form })
        if (!uploadRes.ok) {
          const err = await uploadRes.json()
          setError(err.error ?? 'Upload failed')
          return
        }
        const uploaded = await uploadRes.json()
        payload = { ...payload, ...uploaded }
      } else if (mode === 'drive') {
        payload.url = driveUrl
      } else if (mode === 'dropbox') {
        const isDropboxFile = !dropboxUrl.includes('/fo/')
        payload.url = dropboxUrl
        payload.dropbox_url = dropboxUrl
        payload.is_dropbox_file = isDropboxFile
      }

      const saveRes = await fetch('/api/marketing/artwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!saveRes.ok) {
        const err = await saveRes.json()
        setError(err.error ?? 'Save failed')
        return
      }
      const saved = await saveRes.json()
      onAdded(saved)
      reset()
      onClose()
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Add Artwork</h3>
          <button onClick={() => { reset(); onClose() }} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(['upload', 'drive', 'dropbox'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`py-1.5 text-sm font-semibold rounded-lg border transition-colors ${mode === m ? 'bg-purple-700 text-white border-purple-700' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {m === 'upload' ? 'Upload File' : m === 'drive' ? 'Google Drive' : 'Dropbox Link'}
              </button>
            ))}
          </div>

          {mode === 'upload' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">File</label>
              <input
                type="file"
                required
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setFile(f)
                  if (f && !name) setName(f.name.replace(/\.[^.]+$/, ''))
                }}
                className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
            </div>
          ) : mode === 'drive' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Google Drive URL</label>
              <input
                type="url"
                required
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Dropbox URL</label>
              <input
                type="url"
                required
                value={dropboxUrl}
                onChange={(e) => setDropboxUrl(e.target.value)}
                placeholder="https://www.dropbox.com/..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              <p className="text-xs text-slate-500 mt-1">Paste a link to a Dropbox file or folder. We'll detect which automatically.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Primary Logo"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Optional notes about this file…"
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { reset(); onClose() }}
              className="flex-1 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 py-2 text-sm font-semibold text-white bg-purple-700 rounded-lg hover:bg-purple-800 disabled:opacity-50 transition-colors"
            >
              {uploading ? 'Uploading…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
