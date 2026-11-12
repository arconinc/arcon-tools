import { describe, it, expect } from 'vitest'
import { softDeleteCustomer, softDeleteContact } from './soft-delete'

type Call = { table: string; op: string; args: unknown[] }

// Minimal chainable fake of the Supabase query builder. Each terminal call resolves to the rows it was given.
function fakeAdmin(rows: Record<string, { id: string; customer_id?: string | null; deleted_at?: string | null }[]>) {
  const calls: Call[] = []
  const admin = {
    from(table: string) {
      const state = { table, filters: [] as { col: string; val: unknown; kind: string }[], op: 'select', patch: null as any }
      const builder: any = {
        select() { calls.push({ table, op: 'select', args: [] }); return builder },
        update(patch: any) { state.op = 'update'; state.patch = patch; return builder },
        eq(col: string, val: unknown) { state.filters.push({ col, val, kind: 'eq' }); return builder },
        is(col: string, val: unknown) { state.filters.push({ col, val, kind: 'is' }); return builder },
        maybeSingle() { return run(true) },
        then(resolve: any, reject: any) { return run(false).then(resolve, reject) },
      }
      function run(single: boolean) {
        const matched = (rows[table] ?? []).filter((r) => state.filters.every((f) => {
          if (f.kind === 'eq') return (r as any)[f.col] === f.val
          if (f.kind === 'is') return ((r as any)[f.col] ?? null) === f.val
          return true
        }))
        calls.push({ table, op: state.op, args: [state.filters, state.patch] })
        if (state.op === 'update') for (const r of matched) Object.assign(r, state.patch)
        const data = single ? (matched[0] ?? null) : matched
        return Promise.resolve({ data, error: null })
      }
      return builder
    },
  }
  return { admin: admin as any, calls }
}

describe('softDeleteCustomer', () => {
  it('marks the customer, its active contacts, and its active opportunities with the same timestamp', async () => {
    const rows = {
      crm_customers: [{ id: 'c1' }, { id: 'c2' }],
      crm_contacts: [{ id: 'k1', customer_id: 'c1' }, { id: 'k2', customer_id: 'c2' }, { id: 'k3', customer_id: 'c1', deleted_at: '2020-01-01' }],
      crm_opportunities: [{ id: 'o1', customer_id: 'c1' }, { id: 'o2', customer_id: 'c2' }],
    }
    const { admin } = fakeAdmin(rows as any)
    const at = '2026-11-11T20:00:00.000Z'
    const counts = await softDeleteCustomer(admin, 'c1', at)
    expect(counts).toEqual({ customers: 1, contacts: 1, opportunities: 1 })
    expect(rows.crm_customers[0]).toMatchObject({ deleted_at: at })
    expect(rows.crm_customers[1]).not.toHaveProperty('deleted_at')
    expect(rows.crm_contacts[0]).toMatchObject({ deleted_at: at })
    expect(rows.crm_contacts[1]).not.toHaveProperty('deleted_at')
    expect(rows.crm_contacts[2]).toMatchObject({ deleted_at: '2020-01-01' })
    expect(rows.crm_opportunities[0]).toMatchObject({ deleted_at: at })
    expect(rows.crm_opportunities[1]).not.toHaveProperty('deleted_at')
  })

  it('returns null when the customer is missing or already deleted', async () => {
    const rows = { crm_customers: [{ id: 'c1', deleted_at: '2020-01-01' }], crm_contacts: [], crm_opportunities: [] }
    const { admin } = fakeAdmin(rows as any)
    expect(await softDeleteCustomer(admin, 'c1')).toBeNull()
    expect(await softDeleteCustomer(admin, 'nope')).toBeNull()
  })
})

describe('softDeleteContact', () => {
  it('marks one active contact and reports whether it changed', async () => {
    const rows = { crm_contacts: [{ id: 'k1' }, { id: 'k2', deleted_at: '2020-01-01' }] }
    const { admin } = fakeAdmin(rows as any)
    expect(await softDeleteContact(admin, 'k1', '2026-11-11T00:00:00.000Z')).toBe(true)
    expect(rows.crm_contacts[0]).toMatchObject({ deleted_at: '2026-11-11T00:00:00.000Z' })
    expect(await softDeleteContact(admin, 'k2')).toBe(false)
    expect(await softDeleteContact(admin, 'missing')).toBe(false)
  })
})
