import { describe, it, expect } from 'vitest'
import { findDefaultSpecCsrId } from './spec-defaults'

describe('findDefaultSpecCsrId', () => {
  it('returns Ella Wheatcraft id (case/whitespace insensitive)', () => {
    const users = [
      { id: 'a', display_name: 'Aaron Wheatcraft' },
      { id: 'e', display_name: ' ella wheatcraft ' },
    ]
    expect(findDefaultSpecCsrId(users)).toBe('e')
  })

  it('returns empty string when Ella is not in the list (falls back to "Me")', () => {
    expect(findDefaultSpecCsrId([{ id: 'a', display_name: 'Aaron Wheatcraft' }])).toBe('')
  })
})
