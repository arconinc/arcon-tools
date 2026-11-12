import { describe, it, expect } from 'vitest'
import { hasUnsentDraft } from './task-draft'

describe('hasUnsentDraft', () => {
  it('is false for empty or whitespace-only text with no files', () => {
    expect(hasUnsentDraft('', 0)).toBe(false)
    expect(hasUnsentDraft('  \n ', 0)).toBe(false)
  })
  it('is true when there is text', () => {
    expect(hasUnsentDraft('hello', 0)).toBe(true)
  })
  it('is true when only files are attached', () => {
    expect(hasUnsentDraft('', 1)).toBe(true)
  })
})
