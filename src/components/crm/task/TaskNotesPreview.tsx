'use client'

import { formatRelative } from '@/lib/format'
import type { Comment } from '@/hooks/useTask'

export function TaskNotesPreview({
  comments,
  onViewAll,
}: {
  comments: Comment[]
  onViewAll: () => void
}) {
  const latest = comments[comments.length - 1] ?? null
  const extraCount = comments.length - 1

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-700">Comments</h2>
        {comments.length > 0 && (
          <button
            onClick={onViewAll}
            className="text-xs font-semibold text-purple-700 hover:underline"
          >
            View all ({comments.length})
          </button>
        )}
      </div>
      {!latest ? (
        <div className="px-6 py-4 text-sm text-slate-400">No comments yet.</div>
      ) : (
        <div className="px-6 py-4">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-semibold text-slate-700">{latest.user.display_name}</span>
            <span className="text-xs text-slate-400">{formatRelative(latest.created_at)}</span>
          </div>
          <p className="text-sm text-slate-700 line-clamp-3 whitespace-pre-wrap">{latest.comment}</p>
          {extraCount > 0 && (
            <button
              onClick={onViewAll}
              className="mt-2 text-xs font-semibold text-purple-700 hover:underline"
            >
              {extraCount} more comment{extraCount !== 1 ? 's' : ''} →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
