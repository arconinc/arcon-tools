'use client'

import { useState, useEffect } from 'react'

interface McpToken {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export default function McpTokensCard() {
  const [tokens, setTokens] = useState<McpToken[]>([])
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [endpoint, setEndpoint] = useState('')

  function loadTokens() {
    fetch('/api/mcp/tokens')
      .then((r) => r.json())
      .then((d) => setTokens(d.tokens ?? []))
      .catch(() => setError('Could not load tokens.'))
  }

  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/mcp`)
    loadTokens()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    setCopied(false)

    const res = await fetch('/api/mcp/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json()
    setCreating(false)

    if (!res.ok) {
      setError(data.error ?? 'Could not create token.')
      return
    }

    setNewToken(data.token)
    setName('')
    loadTokens()
  }

  async function handleRevoke(id: string) {
    if (!window.confirm('Revoke this token? Any client using it will stop working.')) return
    setError(null)

    const res = await fetch(`/api/mcp/tokens/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError('Could not revoke token.')
      return
    }
    loadTokens()
  }

  async function handleCopy() {
    if (!newToken) return
    try {
      await navigator.clipboard.writeText(newToken)
      setCopied(true)
    } catch {
      setError('Copy failed. Select the token and copy it manually.')
    }
  }

  const active = tokens.filter((t) => !t.revoked_at)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <h2 className="font-semibold text-slate-800 mb-1">MCP Access Tokens</h2>
      <p className="text-sm text-slate-500 mb-4">
        Let an AI client read and update your tasks, customers, and vendors. Each token acts as you.
      </p>

      <div className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">
        <span className="font-medium">Server URL: </span>
        <code className="break-all">{endpoint || '/api/mcp'}</code>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {newToken && (
        <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <p className="text-sm text-emerald-800 mb-2">
            Copy this token now. It won&apos;t be shown again.
          </p>
          <code className="block break-all text-sm bg-white border border-emerald-200 rounded-lg p-3 mb-3">
            {newToken}
          </code>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {copied ? 'Copied' : 'Copy token'}
            </button>
            <button
              type="button"
              onClick={() => setNewToken(null)}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex gap-2 mb-5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={60}
          placeholder="Token name, e.g. Claude Desktop"
          className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
        >
          {creating ? 'Creating…' : 'Create token'}
        </button>
      </form>

      {active.length === 0 ? (
        <p className="text-sm text-slate-400">No active tokens.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {active.map((t) => (
            <li key={t.id} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                <p className="text-xs text-slate-400">
                  Created {new Date(t.created_at).toLocaleDateString()}
                  {t.last_used_at ? ` · Last used ${new Date(t.last_used_at).toLocaleString()}` : ' · Never used'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(t.id)}
                className="text-sm text-red-600 hover:text-red-700 font-medium shrink-0"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
