import { describe, it, expect } from 'vitest'
import {
  parseEnv,
  authHeader,
  baseUrl,
  fieldInventory,
  tagProfile,
  filterOrgs,
  parseCustomExclusion,
  isImportableOpportunity,
  opportunityStateCounts,
  arcOpportunityStatus,
  isArcPipelineStage,
  reconcileOrgs,
  ownerMap,
  reviewRows,
  reviewWorkbookBuffer,
  readApprovedIds,
} from '../../../scripts/insightly/lib.mjs'

const org = (id: number, name: string, tags: string[], extra: Record<string, unknown> = {}) => ({
  ORGANISATION_ID: id,
  ORGANISATION_NAME: name,
  TAGS: tags.map((t) => ({ TAG_NAME: t })),
  ...extra,
})

describe('parseEnv', () => {
  it('reads KEY=VALUE, skips comments, strips quotes', () => {
    const env = parseEnv('# c\nINSIGHTLY_POD=na1\nINSIGHTLY_API_KEY="abc=="\n\nexport X=\'y\'\n')
    expect(env).toEqual({ INSIGHTLY_POD: 'na1', INSIGHTLY_API_KEY: 'abc==', X: 'y' })
  })
})

describe('auth and base url', () => {
  it('uses key as basic username with blank password', () => {
    expect(authHeader('k')).toBe('Basic ' + Buffer.from('k:').toString('base64'))
    expect(baseUrl('na1')).toBe('https://api.na1.insightly.com/v3.1')
  })
})

describe('fieldInventory', () => {
  it('counts filled vs seen per key, treating blanks and empty arrays as unfilled', () => {
    const inv = fieldInventory([
      { A: 'x', B: '', C: [] },
      { A: null, B: 'y', C: [1] },
    ])
    expect(inv.total).toBe(2)
    const byKey = Object.fromEntries(inv.fields.map((f) => [f.key, f]))
    expect(byKey.A).toMatchObject({ filled: 1, seen: 2, fillRate: 50 })
    expect(byKey.B).toMatchObject({ filled: 1, fillRate: 50 })
    expect(byKey.C).toMatchObject({ filled: 1, fillRate: 50 })
  })
})

describe('tagProfile', () => {
  it('counts orgs per tag, biggest first, and tolerates string tags', () => {
    const profile = tagProfile([
      org(1, 'a', ['Customer', 'Vendor']),
      org(2, 'b', ['Customer']),
      { ORGANISATION_ID: 3, ORGANISATION_NAME: 'c', TAGS: ['Customer'] },
    ])
    expect(profile[0]).toEqual({ tag: 'Customer', orgCount: 3 })
    expect(profile[1]).toEqual({ tag: 'Vendor', orgCount: 1 })
  })
})

describe('filterOrgs', () => {
  const orgs = [
    org(1, 'a', ['Customer']),
    org(2, 'b', ['Customer', 'Dead']),
    org(3, 'c', ['Vendor']),
    org(4, 'd', []),
  ]

  it('keeps everything when no filter is given', () => {
    expect(filterOrgs(orgs).map((o) => o.ORGANISATION_ID)).toEqual([1, 2, 3, 4])
  })

  it('include keeps only orgs with at least one included tag, case-insensitive', () => {
    expect(filterOrgs(orgs, { include: ['customer'] }).map((o) => o.ORGANISATION_ID)).toEqual([1, 2])
  })

  it('excludeCustom removes orgs whose custom field matches exactly, not partially', () => {
    const withField = [
      { ORGANISATION_ID: 1, CUSTOMFIELDS: [{ FIELD_NAME: 'ORGANISATION_FIELD_1', FIELD_VALUE: 'Vendor' }] },
      { ORGANISATION_ID: 2, CUSTOMFIELDS: [{ FIELD_NAME: 'ORGANISATION_FIELD_1', FIELD_VALUE: 'Customer and Vendor' }] },
      { ORGANISATION_ID: 3, CUSTOMFIELDS: [{ FIELD_NAME: 'ORGANISATION_FIELD_2', FIELD_VALUE: 'Vendor' }] },
      { ORGANISATION_ID: 4 },
    ]
    const kept = filterOrgs(withField, { excludeCustom: [{ field: 'ORGANISATION_FIELD_1', value: 'vendor' }] })
    expect(kept.map((o) => o.ORGANISATION_ID)).toEqual([2, 3, 4])
  })

  it('parses FIELD=Value', () => {
    expect(parseCustomExclusion('ORGANISATION_FIELD_1=Vendor')).toEqual({ field: 'ORGANISATION_FIELD_1', value: 'Vendor' })
  })

  it('exclude removes any org carrying an excluded tag, even if included', () => {
    expect(filterOrgs(orgs, { include: ['Customer'], exclude: ['DEAD'] }).map((o) => o.ORGANISATION_ID)).toEqual([1])
  })
})

describe('reconcileOrgs', () => {
  const arc = [
    { id: 'u1', name: 'Acme Co', insightly_id: '10' },
    { id: 'u2', name: 'Beta LLC', insightly_id: null },
    { id: 'u3', name: 'Dup Name', insightly_id: null },
    { id: 'u4', name: 'dup  name', insightly_id: null },
    { id: 'u5', name: 'Gamma', insightly_id: null },
  ]

  it('matches by insightly_id first, then unique name, flags ambiguous, else new', () => {
    const orgs = [
      { ORGANISATION_ID: 10, ORGANISATION_NAME: 'Renamed in Insightly' },
      { ORGANISATION_ID: 20, ORGANISATION_NAME: '  beta llc ' },
      { ORGANISATION_ID: 30, ORGANISATION_NAME: 'Dup Name' },
      { ORGANISATION_ID: 40, ORGANISATION_NAME: 'Nobody' },
    ]
    const { rows, counts } = reconcileOrgs(orgs, arc)
    expect(rows.map((r) => r.status)).toEqual(['matched_id', 'matched_name', 'ambiguous', 'new'])
    expect(rows[0].arcId).toBe('u1')
    expect(rows[1].arcId).toBe('u2')
    expect(rows[2].candidates).toEqual(['u3', 'u4'])
    expect(counts).toEqual({ matched_id: 1, matched_name: 1, ambiguous: 1, new: 1 })
  })
})

describe('opportunity import filter', () => {
  const opps = [
    { OPPORTUNITY_ID: 1, OPPORTUNITY_STATE: 'OPEN' },
    { OPPORTUNITY_ID: 2, OPPORTUNITY_STATE: 'WON' },
    { OPPORTUNITY_ID: 3, OPPORTUNITY_STATE: 'LOST' },
    { OPPORTUNITY_ID: 4, OPPORTUNITY_STATE: 'SUSPENDED' },
    { OPPORTUNITY_ID: 5, OPPORTUNITY_STATE: ' open ' },
    { OPPORTUNITY_ID: 6 },
  ]

  it('imports only OPEN opportunities', () => {
    expect(opps.filter(isImportableOpportunity).map((o) => o.OPPORTUNITY_ID)).toEqual([1, 5])
  })

  it('maps open opportunities to Arc status open and skips the rest', () => {
    expect(arcOpportunityStatus({ OPPORTUNITY_STATE: 'OPEN' })).toBe('open')
    expect(arcOpportunityStatus({ OPPORTUNITY_STATE: 'WON' })).toBeNull()
  })

  it('accepts Send Quote as an Arc pipeline stage', () => {
    expect(isArcPipelineStage('Send Quote')).toBe(true)
    expect(isArcPipelineStage('Negotiation')).toBe(false)
  })

  it('counts states for the report', () => {
    expect(opportunityStateCounts(opps)).toEqual({ OPEN: 2, WON: 1, LOST: 1, SUSPENDED: 1, '(NONE)': 1 })
  })
})

describe('review sheet round trip', () => {
  const orgs = [
    org(101, 'Acme Co', ['Customer'], {
      OWNER_USER_ID: 7,
      ADDRESS_BILLING_CITY: 'Tulsa',
      ADDRESS_BILLING_STATE: 'OK',
      WEBSITE: 'acme.test',
      DATE_CREATED_UTC: '2020-01-02T03:04:05Z',
    }),
    org(102, 'Beta LLC', ['Customer']),
    org(103, 'Gamma', ['Customer']),
  ]
  const owners = ownerMap([{ USER_ID: 7, FIRST_NAME: 'Pat', LAST_NAME: 'Lee', EMAIL_ADDRESS: 'pat@example.test' }])
  const rows = reviewRows(orgs, { arcByInsightlyId: new Map([['102', { id: 'arc-102' }]]), owners })

  it('fills owner, location, dates and Arc status', () => {
    expect(rows[0]).toMatchObject({
      'Insightly ID': '101',
      Owner: 'Pat Lee',
      'Owner email': 'pat@example.test',
      City: 'Tulsa',
      'Created (UTC)': '2020-01-02 03:04:05',
      'Already in Arc': 'N',
      'Include?': 'Y',
    })
    expect(rows[1]).toMatchObject({ 'Already in Arc': 'Y', 'Arc ID': 'arc-102' })
  })

  it('reads back only Y rows, ignoring N, blank and deleted rows', () => {
    const edited = rows.slice(0, 3).map((r, i) => ({ ...r, 'Include?': i === 0 ? 'Y' : i === 1 ? 'N' : '' }))
    const buf = reviewWorkbookBuffer(edited)
    const result = readApprovedIds(buf)
    expect(result).toEqual({ ids: ['101'], excluded: 2, total: 3 })
  })

  it('reads numeric Insightly IDs (Excel stores them as numbers)', () => {
    const buf = reviewWorkbookBuffer([{ ...rows[0], 'Insightly ID': 101 as unknown as string }])
    expect(readApprovedIds(buf).ids).toEqual(['101'])
  })
})
