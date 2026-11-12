import { describe, it, expect } from 'vitest'
import { mergePolledThread, mergePolledList } from './task-poll'

describe('mergePolledThread', () => {
  it('keeps user-edited fields, takes thread, reports new comments', () => {
    const current = { title: 'my draft', comments: [{ id: 'a' }], history: [], attachments: [] }
    const fresh = { title: 'server', comments: [{ id: 'a' }, { id: 'b' }], history: [], attachments: [] }
    const { task, newCommentIds } = mergePolledThread(current, fresh)
    expect(task.title).toBe('my draft')
    expect(task.comments).toHaveLength(2)
    expect(newCommentIds).toEqual(['b'])
  })
  it('returns same reference when nothing changed', () => {
    const current = { comments: [{ id: 'a' }], history: [], attachments: [] }
    const { task, newCommentIds } = mergePolledThread(current, structuredClone(current))
    expect(task).toBe(current)
    expect(newCommentIds).toEqual([])
  })
})

describe('mergePolledList', () => {
  it('returns prev when unchanged', () => {
    const prev = [{ id: '1', unread_comment_count: 0 }]
    expect(mergePolledList(prev, [{ id: '1', unread_comment_count: 0 }], null)).toBe(prev)
  })
  it('zeroes unread for the open task only', () => {
    const out = mergePolledList([], [{ id: '1', unread_comment_count: 2 }, { id: '2', unread_comment_count: 3 }], '1')
    expect(out.map((t) => t.unread_comment_count)).toEqual([0, 3])
  })
})
