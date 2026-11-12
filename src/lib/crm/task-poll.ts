// Pure merge helpers for background task polling. Polls must never clobber
// what the user is editing, so they only touch the fields others can change
// without the user having a draft: the thread (comments/history/attachments)
// on an open task, and the list rows on the board.

type Threaded = {
  comments?: { id: string }[]
  history?: unknown[]
  attachments?: unknown[]
}

export function mergePolledThread<T extends Threaded>(
  current: T,
  fresh: T,
): { task: T; newCommentIds: string[] } {
  const known = new Set((current.comments ?? []).map((c) => c.id))
  const newCommentIds = (fresh.comments ?? []).filter((c) => !known.has(c.id)).map((c) => c.id)
  const same =
    JSON.stringify([current.comments, current.history, current.attachments]) ===
    JSON.stringify([fresh.comments, fresh.history, fresh.attachments])
  if (same) return { task: current, newCommentIds }
  return {
    task: { ...current, comments: fresh.comments, history: fresh.history, attachments: fresh.attachments },
    newCommentIds,
  }
}

// Returns `prev` untouched when nothing changed, so React skips the re-render.
// The task open in the modal is being read live, so its unread badge stays 0.
export function mergePolledList<T extends { id: string; unread_comment_count?: number }>(
  prev: T[],
  fresh: T[],
  openTaskId: string | null,
): T[] {
  const next = openTaskId
    ? fresh.map((t) => (t.id === openTaskId ? { ...t, unread_comment_count: 0 } : t))
    : fresh
  return JSON.stringify(prev) === JSON.stringify(next) ? prev : next
}
