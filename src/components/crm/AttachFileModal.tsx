'use client'

import { useState } from 'react'
import { uploadAttachment } from '@/lib/crm/upload-attachment'

export type AttachedFile = { id: string; label: string; url: string; created_at: string }

/** Attach-file modal shared by the customer and supplier Related tabs. */
export function AttachFileModal({
  open,
  onClose,
  uploadUrl,
  onAttached,
}: {
  open: boolean
  onClose: () => void
  /** POST endpoint that persists { label, url } and returns the created file row. */
  uploadUrl: string
  onAttached: (file: AttachedFile) => void
}) {
  const [label, setLabel] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  function close() {
    setLabel('')
    setFile(null)
    setError(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !label.trim()) return
    setUploading(true)
    setError(null)
    try {
      const uploaded = await uploadAttachment(file).catch((err: Error) => { setError(err.message ?? 'Upload failed'); return null })
      if (!uploaded) return

      const saveRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), url: uploaded.url }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) { setError(saveData.error ?? 'Save failed'); return }

      onAttached(saveData)
      close()
    } finally { setUploading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Attach File</h2>
          <button onClick={close} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. W9, Price Sheet, Contract"
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">File</label>
            <input
              type="file"
              required
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setFile(f)
                if (f && !label.trim()) {
                  setLabel(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim())
                }
              }}
              className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
            />
            <p className="mt-1 text-xs text-slate-400">Max 10MB</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file || !label.trim()}
              className="px-4 py-2 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading…' : 'Attach'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
