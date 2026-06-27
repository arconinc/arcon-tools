'use client'

import { useState } from 'react'
import type { PollData } from '@/types'

interface PollBlockProps {
  articleId: string
  poll: PollData
  variant?: 'card' | 'detail'
  showVoters?: boolean
}

export function PollBlock({ articleId, poll, variant = 'card', showVoters = false }: PollBlockProps) {
  const [pollState, setPollState] = useState(poll)
  const [selectedOptionId, setSelectedOptionId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasVoted = Boolean(pollState.user_vote_option_id)
  const compact = variant === 'card'
  const totalVotes = pollState.total_votes

  async function submitVote() {
    if (!selectedOptionId || submitting) return
    setSubmitting(true)
    setError(null)
    const res = await fetch(`/api/news/${articleId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option_id: selectedOptionId }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(data.error ?? 'Vote failed')
      return
    }
    setPollState(data.poll)
  }

  return (
    <div className={compact ? 'space-y-2' : 'bg-white border border-slate-200 rounded-2xl p-6 space-y-4'}>
      <div>
        <p className={compact ? 'text-xs font-semibold text-slate-700 line-clamp-2' : 'text-lg font-semibold text-slate-900'}>
          {pollState.question}
        </p>
        {hasVoted && (
          <p className={compact ? 'text-[11px] text-slate-400 mt-1' : 'text-sm text-slate-500 mt-1'}>
            {totalVotes} vote{totalVotes === 1 ? '' : 's'} total
          </p>
        )}
      </div>

      {hasVoted ? (
        <div className={compact ? 'space-y-1.5' : 'space-y-3'}>
          {pollState.options.map((option) => {
            const percent = totalVotes === 0 ? 0 : Math.round((option.vote_count / totalVotes) * 100)
            const selected = option.id === pollState.user_vote_option_id
            return (
              <div key={option.id}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`${compact ? 'text-[11px]' : 'text-sm'} font-medium ${selected ? 'text-purple-700' : 'text-slate-700'} line-clamp-1`}>
                    {option.option_text}{selected ? ' (your vote)' : ''}
                  </span>
                  <span className={`${compact ? 'text-[11px]' : 'text-sm'} text-slate-500 whitespace-nowrap`}>
                    {percent}% · {option.vote_count}
                  </span>
                </div>
                <div className={`w-full overflow-hidden rounded-full bg-slate-100 ${compact ? 'h-2' : 'h-3'}`}>
                  <div
                    className={`h-full rounded-full ${selected ? 'bg-purple-600' : 'bg-slate-300'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {pollState.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedOptionId(option.id)}
              className={`w-full text-left rounded-xl border px-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 ${compact ? 'py-2 text-xs' : 'py-3 text-sm'} ${
                selectedOptionId === option.id
                  ? 'border-purple-300 bg-purple-50 text-purple-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {option.option_text}
            </button>
          ))}
          <button
            type="button"
            onClick={submitVote}
            disabled={!selectedOptionId || submitting}
            className={`w-full rounded-xl bg-purple-600 font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 ${compact ? 'py-2 text-xs' : 'py-3 text-sm'}`}
          >
            {submitting ? 'Voting...' : 'Vote'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {showVoters && (
        <details className="pt-3 border-t border-slate-100">
          <summary className="cursor-pointer text-sm font-semibold text-purple-700">See voters</summary>
          <div className="mt-4 space-y-4">
            {pollState.options.map((option) => (
              <div key={option.id}>
                <div className="text-sm font-semibold text-slate-800">{option.option_text}</div>
                {option.voters && option.voters.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {option.voters.map((voter) => (
                      <span key={voter.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                        {voter.display_name || voter.email}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">No votes yet.</p>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
