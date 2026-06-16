'use client'

import { useState } from 'react'

export function CloseReasonModal({
  result,
  onConfirm,
  onCancel,
}: {
  result: 'won' | 'lost'
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const isWon = result === 'won'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          {isWon ? '🏆 Close as Won' : '❌ Close as Lost'}
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          {isWon
            ? 'What led to winning this opportunity?'
            : 'What was the reason for losing this opportunity?'}
        </p>
        <textarea
          autoFocus
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={isWon ? 'e.g. Customer accepted our quote' : 'e.g. Lost to competitor on price'}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none mb-4"
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            className={`px-4 py-2 text-sm font-semibold rounded-xl text-white transition-colors ${
              isWon ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isWon ? 'Mark as Won' : 'Mark as Lost'}
          </button>
        </div>
      </div>
    </div>
  )
}
