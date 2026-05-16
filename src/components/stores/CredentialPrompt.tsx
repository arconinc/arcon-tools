'use client'

import { useState } from 'react'

interface Props {
  onSaved: () => void
  onDismiss?: () => void
}

export function CredentialPrompt({ onSaved, onDismiss }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch('/api/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error ?? 'Failed to save credentials. Please check your username and password.')
      return
    }
    onSaved()
  }

  return (
    <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm max-w-sm w-full">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Connect PromoBullit</h3>
          <p className="text-xs text-slate-500 mt-0.5">Enter your credentials to sync orders.</p>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 ml-3 mt-0.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-xs text-blue-800">
          Credentials are encrypted and only used server-side. You can also manage them in Settings.
        </p>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
          autoComplete="username"
          placeholder="PromoBullit username"
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          placeholder="Password"
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
        />
        <button
          type="submit"
          disabled={saving || !username || !password}
          className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
        >
          {saving ? 'Saving…' : 'Save & Sync'}
        </button>
      </form>
    </div>
  )
}
