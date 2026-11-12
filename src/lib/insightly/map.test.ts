import { describe, it, expect } from 'vitest'
import {
  htmlToText,
  parseUsDate,
  tagNames,
  mapNote,
  mapContact,
  mapContactMeta,
  mapOpportunity,
  mapOrganisation,
  gapFill,
  nameFromEmailLocal,
} from '../../../scripts/insightly/map.mjs'

const exportField = (name: string, value: string) => ({ FIELD_NAME: name, FIELD_VALUE: value })

describe('htmlToText', () => {
  it('turns paragraphs and breaks into lines and decodes entities', () => {
    expect(htmlToText('<p>Intro call&nbsp;today</p><p>Tom &amp; Jerry &#39;quoted&#39;</p>')).toBe(
      'Intro call today\nTom & Jerry \'quoted\'',
    )
  })

  it('keeps link URLs', () => {
    expect(htmlToText('<a href="https://example.com/x">our site</a>')).toBe('our site (https://example.com/x)')
    expect(htmlToText('<a href="https://example.com">https://example.com</a>')).toBe('https://example.com')
  })

  it('returns null for blank input', () => {
    expect(htmlToText(null)).toBeNull()
    expect(htmlToText('   ')).toBeNull()
    expect(htmlToText('<p></p>')).toBeNull()
  })
})

describe('parseUsDate', () => {
  it('reads Insightly custom date text as a date', () => {
    expect(parseUsDate('8/16/2020 12:00:00 AM')).toBe('2020-08-16')
    expect(parseUsDate('3/19/1976 12:00:00 AM')).toBe('1976-03-19')
  })

  it('returns null for text that is not a date', () => {
    expect(parseUsDate('?')).toBeNull()
    expect(parseUsDate(null)).toBeNull()
  })
})

describe('tagNames', () => {
  it('reads export and API shapes, drops blanks, de-dupes case-insensitively', () => {
    expect(tagNames([{ NAME: 'Rapala' }, { TAG_NAME: 'RAPALA' }, { NAME: '' }, { NAME: 'MTA' }])).toEqual(['Rapala', 'MTA'])
    expect(tagNames(undefined)).toEqual([])
  })
})

describe('mapNote', () => {
  it('maps the primary subject type to a kind and keeps the Insightly date', () => {
    const note = mapNote({
      NOTE_ID: '17662441',
      TITLE: 'contact',
      BODY: '<p>intro call</p>',
      PRIMARY_SUBJECT_ID: '90264770',
      PRIMARY_SUBJECT_TYPE: 'Contact',
      OWNER_USER_ID: '700022',
      DATE_CREATED_UTC: '2014-12-05T19:49:38.21',
    })
    expect(note.subjectKind).toBe('contact')
    expect(note.subjectInsightlyId).toBe('90264770')
    expect(note.ownerInsightlyId).toBe('700022')
    expect(note.row).toEqual({
      insightly_note_id: '17662441',
      title: 'contact',
      body: 'intro call',
      created_at: '2014-12-05T19:49:38.21Z',
    })
  })

  it('accepts upper-case subject types and returns null kind for leads', () => {
    expect(mapNote({ NOTE_ID: '1', PRIMARY_SUBJECT_TYPE: 'ORGANISATION', PRIMARY_SUBJECT_ID: '5' }).subjectKind).toBe('customer')
    expect(mapNote({ NOTE_ID: '2', PRIMARY_SUBJECT_TYPE: 'LEAD', PRIMARY_SUBJECT_ID: '6' }).subjectKind).toBeNull()
  })
})

describe('mapContact new fields', () => {
  const base = { CONTACT_ID: 1, FIRST_NAME: 'Ann', LAST_NAME: 'Lee' }

  it('maps custom fields to their Arc columns', () => {
    const row = mapContact(
      {
        ...base,
        CUSTOMFIELDS: [
          exportField('INDUSTRY__c', 'Trucking'),
          exportField('Profile_Segmentation__c', 'Top 50 clients'),
          exportField('Product_Showcase_Invite__c', 'True'),
          exportField('CONTACT_FIELD_9', 'www.example.com'),
          exportField('CONTACT_FIELD_6', 'Lures'),
          exportField('CONTACT_FIELD_8', 'Vendor'),
          exportField('LinkedIn_1__c', 'https://www.linkedin.com/in/ann'),
        ],
      },
      { customerId: 'c1' },
    )
    expect(row).toMatchObject({
      industry: 'Trucking',
      profile_segmentation: 'Top 50 clients',
      product_showcase_invite: 'True',
      organization_website: 'www.example.com',
      products_purchased: 'Lures',
      type_of_contact: 'Vendor',
      linkedin: 'https://www.linkedin.com/in/ann',
    })
  })

  it('leaves type_of_contact null for values outside the Arc enum', () => {
    const meta = mapContactMeta({ ...base, CUSTOMFIELDS: [exportField('CONTACT_FIELD_8', 'Competitor')] })
    expect(mapContact({ ...base, CUSTOMFIELDS: [exportField('CONTACT_FIELD_8', 'Competitor')] }, { customerId: null }).type_of_contact).toBeNull()
    expect(meta.problems).toEqual(['type_of_contact "Competitor" not in enum (left null)'])
  })

  it('prefers the SOCIAL_LINKEDIN field over LinkedIn_1__c when both exist', () => {
    const row = mapContact({ ...base, SOCIAL_LINKEDIN: 'https://a', CUSTOMFIELDS: [exportField('LinkedIn_1__c', 'https://b')] }, { customerId: null })
    expect(row.linkedin).toBe('https://a')
  })

  it('puts CONTACT_FIELD_7 into an important date with a label', () => {
    const row = mapContact({ ...base, CUSTOMFIELDS: [exportField('CONTACT_FIELD_7', '8/16/2020 12:00:00 AM')] }, { customerId: null })
    expect(row.important_date_1).toBe('2020-08-16')
    expect(row.important_date_1_name).toBe('Insightly CONTACT_FIELD_7')
  })

  it('returns created date, tag names and the salesperson name in the meta', () => {
    const meta = mapContactMeta({
      ...base,
      DATE_CREATED_UTC: '2015-01-02T03:04:05',
      TAGS: [{ NAME: 'Rapala' }],
      CUSTOMFIELDS: [exportField('CONTACT_FIELD_1', 'Aaron Wheatcraft')],
    })
    expect(meta).toMatchObject({ createdAt: '2015-01-02T03:04:05Z', tagNames: ['Rapala'], salespersonName: 'Aaron Wheatcraft', problems: [] })
  })
})

describe('mapOpportunity new fields', () => {
  it('maps closed date, responsible user, CSR and created date; returns tags', () => {
    const mapped = mapOpportunity(
      {
        OPPORTUNITY_ID: 9,
        OPPORTUNITY_NAME: 'Hats',
        OPPORTUNITY_STATE: 'OPEN',
        OWNER_USER_ID: 1,
        RESPONSIBLE_USER_ID: 2,
        CSR__c: '2117998',
        ACTUAL_CLOSE_DATE: '2015-01-20T00:00:00',
        DATE_CREATED_UTC: '2014-11-06T15:21:37.377',
        TAGS: [{ NAME: 'Envoy' }],
      },
      { customerId: 'c1', stageName: null, pipelineName: null },
    )
    expect(mapped.row.closed_at).toBe('2015-01-20T00:00:00Z')
    expect(mapped.responsibleInsightlyId).toBe('2')
    expect(mapped.csrInsightlyId).toBe('2117998')
    expect(mapped.createdAt).toBe('2014-11-06T15:21:37.377Z')
    expect(mapped.tagNames).toEqual(['Envoy'])
  })

  it('still returns null for closed opportunities', () => {
    expect(mapOpportunity({ OPPORTUNITY_ID: 9, OPPORTUNITY_STATE: 'WON' }, { customerId: null, stageName: null, pipelineName: null })).toBeNull()
  })
})

describe('mapOrganisation created date and tags', () => {
  it('returns created date and tag names outside the row', () => {
    const mapped = mapOrganisation({ ORGANISATION_ID: 3, ORGANISATION_NAME: 'Acme', DATE_CREATED_UTC: '2016-05-06T07:08:09', TAGS: [{ NAME: 'ProductShowcase' }] })
    expect(mapped.createdAt).toBe('2016-05-06T07:08:09Z')
    expect(mapped.tagNames).toEqual(['ProductShowcase'])
    expect(mapped.row).not.toHaveProperty('created_at')
    expect(mapped.row).not.toHaveProperty('tagNames')
  })
})

describe('gapFill comparison', () => {
  it('does not count case or edge spaces as drift', () => {
    const { fills, drift } = gapFill({ product_showcase_invite: 'TRUE', title: ' CEO ' }, { product_showcase_invite: 'True', title: 'ceo' })
    expect(fills).toEqual({})
    expect(drift).toEqual([])
  })

  it('still reports real differences and fills blanks', () => {
    const { fills, drift } = gapFill({ title: 'Director', phone: null }, { title: 'VP', phone: '555' })
    expect(fills).toEqual({ phone: '555' })
    expect(drift).toEqual([{ field: 'title', arc: 'Director', insightly: 'VP' }])
  })
})

describe('nameFromEmailLocal', () => {
  it('splits first.last from an email in FIRST_NAME when LAST_NAME is blank', () => {
    expect(nameFromEmailLocal('Debbie.Lee@cli-services.com', null)).toEqual({ first: 'Debbie', last: 'Lee' })
  })

  it('leaves normal names alone', () => {
    expect(nameFromEmailLocal('Ann', 'Lee')).toEqual({ first: 'Ann', last: 'Lee' })
    expect(nameFromEmailLocal('Ann', null)).toEqual({ first: 'Ann', last: null })
    expect(nameFromEmailLocal('shalynn@visualpromotions.net', null)).toEqual({ first: 'shalynn@visualpromotions.net', last: null })
  })
})
