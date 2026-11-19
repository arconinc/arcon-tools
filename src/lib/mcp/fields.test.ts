import { describe, expect, it } from 'vitest'
import { CUSTOMER_FIELDS, VENDOR_FIELDS } from './fields'

const columns = (select: string) => select.split(',').map((c) => c.trim())

describe('vendor field allowlist', () => {
  it('never includes supplier login or account columns', () => {
    const cols = columns(VENDOR_FIELDS)
    for (const forbidden of ['arcon_username', 'arcon_password', 'arcon_account_number']) {
      expect(cols).not.toContain(forbidden)
    }
  })

  it('has no wildcard and no password- or username-like column', () => {
    expect(VENDOR_FIELDS).not.toContain('*')
    for (const col of columns(VENDOR_FIELDS)) {
      expect(col).not.toMatch(/password|username|secret|token/)
    }
  })
})

describe('customer field allowlist', () => {
  it('uses explicit columns, not a wildcard', () => {
    expect(CUSTOMER_FIELDS).not.toContain('*')
    expect(columns(CUSTOMER_FIELDS)).toContain('name')
  })
})
