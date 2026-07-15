import crypto from 'crypto'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

const KNOWN_CATEGORIES = [
  'Holiday Items',
  'Client Appreciation',
  'Employee Recognition',
  'Apparel',
  'Printed Materials',
  'Custom Packaging',
  'Safety Goals',
  'New Hire Gifting',
] as const

let cachedToken: { token: string; expiresAt: number } | null = null

async function getGoogleSheetsToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.token

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!clientEmail || !rawKey) {
    throw new Error('Google service account environment variables are not configured')
  }
  const privateKey = rawKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n')

  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: clientEmail,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey)
  const assertion = `${unsigned}.${b64url(sig)}`

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string }
  if (!res.ok || !body.access_token) {
    throw new Error(body.error_description ?? body.error ?? `Google Sheets auth failed (${res.status})`)
  }

  cachedToken = { token: body.access_token, expiresAt: now + (body.expires_in ?? 3600) }
  return cachedToken.token
}

function b64url(input: string | Buffer) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export interface ProductShowcaseRegistration {
  submittedAt: Date
  firstName: string
  lastName: string
  email: string
  company: string
  jobTitle?: string
  phone?: string
  salesPersonName: string
  categories: string[]
  additionalAttendees: { first_name: string; last_name: string; email: string }[]
}

function buildRow(
  person: { firstName: string; lastName: string; email: string; jobTitle?: string; phone?: string },
  registration: ProductShowcaseRegistration,
  attendeeType: 'Primary' | 'Guest'
): string[] {
  const { submittedAt, company, salesPersonName, categories } = registration

  // Separate known categories from any custom "Other" text
  const otherText = categories.filter((c) => !(KNOWN_CATEGORIES as readonly string[]).includes(c)).join(', ')

  return [
    submittedAt.toISOString(),
    person.firstName,
    person.lastName,
    person.email,
    company,
    person.jobTitle ?? '',
    person.phone ?? '',
    salesPersonName,
    attendeeType,
    ...KNOWN_CATEGORIES.map((cat) => (categories.includes(cat) ? 'Yes' : '')),
    otherText,
  ]
}

export async function appendProductShowcaseRows(registration: ProductShowcaseRegistration): Promise<void> {
  const spreadsheetId = process.env.PRODUCT_SHOWCASE_SHEET_ID
  if (!spreadsheetId) {
    console.warn('[ProductShowcase] PRODUCT_SHOWCASE_SHEET_ID is not set — skipping Google Sheets logging')
    return
  }

  const rows: string[][] = []

  rows.push(buildRow(
    {
      firstName: registration.firstName,
      lastName: registration.lastName,
      email: registration.email,
      jobTitle: registration.jobTitle,
      phone: registration.phone,
    },
    registration,
    'Primary'
  ))

  for (const attendee of registration.additionalAttendees) {
    rows.push(buildRow(
      { firstName: attendee.first_name.trim(), lastName: attendee.last_name.trim(), email: attendee.email.trim() },
      registration,
      'Guest'
    ))
  }

  const token = await getGoogleSheetsToken()
  const sheetName = process.env.PRODUCT_SHOWCASE_SHEET_NAME ?? 'Sheet1'
  const range = encodeURIComponent(sheetName)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: rows }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Google Sheets append failed (${res.status}): ${errBody}`)
  }
}
