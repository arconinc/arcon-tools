/**
 * Google Drive API helper for expense reports.
 *
 * Uses domain-wide delegation so the service account impersonates a real
 * Google Workspace user. Files are created in that user's Drive (no service
 * account quota issues) and per-file permissions control who can see each report.
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL   — service account email
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY — service account private key
 *   GOOGLE_DRIVE_IMPERSONATE_EMAIL — Google Workspace user to impersonate
 *                                    (e.g. expenses@arconinc.com or Amy's email)
 *
 * Setup: domain-wide delegation must be granted in Google Workspace Admin for
 * the service account client ID with scope https://www.googleapis.com/auth/drive
 */

import crypto from 'crypto'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
// Include Sheets scope so the same token can write metadata to the copied sheet
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets'

type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

type DriveFile = {
  id: string
  webViewLink: string
  name: string
}

type DriveError = {
  error?: { code?: number; message?: string; status?: string }
}

// Token cache separate from the calendar cache (different scope + sub claim)
let cachedToken: { token: string; expiresAt: number } | null = null

// ─── Token acquisition ────────────────────────────────────────────────────────

async function getDriveAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.token

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  const impersonateEmail = process.env.GOOGLE_DRIVE_IMPERSONATE_EMAIL
  if (!clientEmail || !rawKey) {
    throw new Error('Google service account env vars are not configured')
  }
  if (!impersonateEmail) {
    throw new Error('GOOGLE_DRIVE_IMPERSONATE_EMAIL is not configured')
  }
  const privateKey = rawKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n')

  // The `sub` claim causes Google to issue the token as the impersonated user.
  // This requires domain-wide delegation granted in Google Workspace Admin.
  const assertion = signJwt(
    { iss: clientEmail, sub: impersonateEmail, scope: GOOGLE_DRIVE_SCOPE, aud: GOOGLE_TOKEN_URL, iat: now, exp: now + 3600 },
    privateKey
  )

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })

  const body = (await res.json()) as GoogleTokenResponse
  if (!res.ok || !body.access_token) {
    throw new Error(body.error_description ?? body.error ?? `Drive auth failed (${res.status})`)
  }

  cachedToken = { token: body.access_token, expiresAt: now + (body.expires_in ?? 3600) }
  return cachedToken.token
}

// ─── Drive API helpers ────────────────────────────────────────────────────────

async function driveRequest<T>(
  method: string,
  url: string,
  body?: unknown,
  queryParams?: Record<string, string>
): Promise<T> {
  const token = await getDriveAccessToken()
  const fullUrl = queryParams
    ? `${url}?${new URLSearchParams(queryParams)}`
    : url
  const res = await fetch(fullUrl, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = (await res.json()) as T & DriveError
  if (!res.ok) {
    const msg = (data as DriveError)?.error?.message ?? `Drive API error ${res.status}`
    throw new Error(msg)
  }
  return data
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a copy of the template Sheet in the designated folder,
 * grants the employee and reviewer editor access, and returns the
 * new file's ID and direct view link.
 */
export async function copyExpenseTemplate(
  templateFileId: string,
  folderId: string,
  title: string,
  employeeEmail: string,
  reviewerEmail: string
): Promise<{ fileId: string; webViewLink: string }> {
  // 1. Copy the template file into the destination folder
  const copied = await driveRequest<DriveFile>(
    'POST',
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(templateFileId)}/copy`,
    { name: title, parents: [folderId] },
    { fields: 'id,webViewLink,name', supportsAllDrives: 'true' }
  )

  // 2. Grant employee editor access
  await driveRequest(
    'POST',
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(copied.id)}/permissions`,
    { type: 'user', role: 'writer', emailAddress: employeeEmail },
    { supportsAllDrives: 'true', sendNotificationEmail: 'false' }
  )

  // 3. Grant reviewer editor access (if different from employee)
  if (reviewerEmail.toLowerCase() !== employeeEmail.toLowerCase()) {
    await driveRequest(
      'POST',
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(copied.id)}/permissions`,
      { type: 'user', role: 'writer', emailAddress: reviewerEmail },
      { supportsAllDrives: 'true', sendNotificationEmail: 'false' }
    )
  }

  return { fileId: copied.id, webViewLink: copied.webViewLink }
}

/**
 * Adds or removes a user's access to an existing expense report file.
 * Pass role='remove' to revoke access.
 */
export async function updateFilePermission(
  fileId: string,
  email: string,
  role: 'writer' | 'reader' | 'remove'
): Promise<void> {
  if (role === 'remove') {
    // List permissions to find the one for this email
    const perms = await driveRequest<{ permissions?: { id: string; emailAddress?: string }[] }>(
      'GET',
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`,
      undefined,
      { fields: 'permissions(id,emailAddress)', supportsAllDrives: 'true' }
    )
    const match = (perms.permissions ?? []).find(
      (p) => p.emailAddress?.toLowerCase() === email.toLowerCase()
    )
    if (match) {
      await driveRequest(
        'DELETE',
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions/${match.id}`,
        undefined,
        { supportsAllDrives: 'true' }
      )
    }
  } else {
    await driveRequest(
      'POST',
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`,
      { type: 'user', role, emailAddress: email },
      { supportsAllDrives: 'true', sendNotificationEmail: 'false' }
    )
  }
}

/**
 * Writes submitter/reviewer emails and report URLs into a hidden "_arc" sheet
 * inside the copied expense report. This lets the Apps Script identify users
 * without needing Session.getActiveUser(), removing the userinfo.email OAuth scope.
 *
 * Called after the DB record is created (so the report ID / URLs are known).
 * Errors are non-fatal — the report has already been created successfully.
 *
 * Sheet layout:
 *   _arc!A1 — submitter email
 *   _arc!A2 — reviewer email
 *   _arc!A3 — employee report URL  (/expense-reports/{id})
 *   _arc!A4 — admin report URL     (/admin/expense-reports/{id})
 */
export async function writeArcSheetMetadata(
  fileId: string,
  submitterEmail: string,
  reviewerEmail: string,
  submitterReportUrl: string,
  adminReportUrl: string
): Promise<void> {
  const sheetsBase = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}`

  // Add a hidden "_arc" sheet (ignore error if it already exists in the template)
  try {
    await driveRequest('POST', `${sheetsBase}:batchUpdate`, {
      requests: [{ addSheet: { properties: { title: '_arc', hidden: true } } }],
    })
  } catch {
    // Sheet may already exist — continue to write values
  }

  // Write all metadata in one request
  await driveRequest(
    'PUT',
    `${sheetsBase}/values/_arc!A1:A4`,
    {
      values: [
        [submitterEmail],
        [reviewerEmail],
        [submitterReportUrl],
        [adminReportUrl],
      ],
    },
    { valueInputOption: 'RAW' }
  )
}

/**
 * Appends rows to the main data sheet (Sheet1) of an expense report file.
 * Uses the same drive+spreadsheets token as writeArcSheetMetadata.
 */
/**
 * Inserts rows at the top of the data table in the "Detailed Log" sheet
 * (row 6, immediately after the header row at row 5), pushing existing
 * entries and the Total row down.
 *
 * Two-step: insertDimension creates blank rows at the right position,
 * then values.update fills them. values:append always goes to the table
 * end so it can't be used for top-of-table insertion.
 */
export async function appendExpenseRows(
  fileId: string,
  rows: string[][]
): Promise<void> {
  const sheetsBase = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(fileId)}`

  // 1. Resolve the numeric sheetId for "Detailed Log"
  const meta = await driveRequest<{
    sheets: { properties: { title: string; sheetId: number } }[]
  }>('GET', sheetsBase, undefined, { fields: 'sheets.properties(title,sheetId)' })

  const sheet = meta.sheets.find((s) => s.properties.title === 'Detailed Log')
  if (!sheet) throw new Error('Sheet tab "Detailed Log" not found in this spreadsheet.')

  // 2. Insert N blank rows at index 5 (0-based) = row 6 (1-based), between header and first data row
  await driveRequest('POST', `${sheetsBase}:batchUpdate`, {
    requests: [
      {
        insertDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: 5,                    // row 6 (0-based)
            endIndex: 5 + rows.length,
          },
          inheritFromBefore: false,           // inherit formatting from first data row, not header
        },
      },
    ],
  })

  // 3. Write data into the newly inserted rows
  const range = encodeURIComponent('Detailed Log!A6')
  await driveRequest(
    'PUT',
    `${sheetsBase}/values/${range}`,
    { values: rows },
    { valueInputOption: 'USER_ENTERED' }
  )
}

// ─── JWT helpers (mirrors google-calendar.ts) ─────────────────────────────────

function signJwt(payload: Record<string, string | number>, privateKey: string): string {
  const header = { alg: 'RS256', typ: 'JWT' }
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey)
  return `${unsigned}.${base64Url(sig)}`
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
