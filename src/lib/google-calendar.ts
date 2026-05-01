import crypto from 'crypto'
import {
  classifyCalendarEvent,
  getCompanyCalendarId,
  stripTypePrefix,
} from '@/lib/company-calendar-config'
import { CompanyCalendarEvent } from '@/types'

type GoogleCalendarEventDate = {
  date?: string
  dateTime?: string
  timeZone?: string
}

type GoogleCalendarEvent = {
  id: string
  summary?: string
  description?: string
  location?: string
  htmlLink?: string
  colorId?: string
  status?: string
  start?: GoogleCalendarEventDate
  end?: GoogleCalendarEventDate
}

type GoogleCalendarListResponse = {
  items?: GoogleCalendarEvent[]
  error?: {
    code?: number
    status?: string
    message?: string
  }
}

type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

let cachedToken: { token: string; expiresAt: number } | null = null

export async function fetchCompanyCalendarEvents(timeMin: string, timeMax: string): Promise<CompanyCalendarEvent[]> {
  const calendarId = getCompanyCalendarId()
  const accessToken = await getGoogleAccessToken()
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
  url.searchParams.set('timeMin', timeMin)
  url.searchParams.set('timeMax', timeMax)
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '250')

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  const body = (await response.json()) as GoogleCalendarListResponse
  if (!response.ok) {
    throw new Error(formatGoogleApiError(`Unable to fetch Google Calendar events (calendarId: ${calendarId})`, response.status, body.error))
  }

  return (body.items ?? [])
    .filter((event) => event.status !== 'cancelled' && event.start)
    .map(normalizeGoogleEvent)
}

function normalizeGoogleEvent(event: GoogleCalendarEvent): CompanyCalendarEvent {
  const title = event.summary?.trim() || 'Untitled event'
  const type = classifyCalendarEvent(event.colorId ?? null, title)
  const cleanTitle = stripTypePrefix(title, type) || title
  const allDay = Boolean(event.start?.date)

  return {
    id: event.id,
    title: cleanTitle,
    type: type.id,
    typeLabel: type.label,
    start: event.start?.date ?? event.start?.dateTime ?? '',
    end: event.end?.date ?? event.end?.dateTime ?? null,
    allDay,
    description: event.description ? htmlToPlainText(event.description) : null,
    location: event.location?.trim() || null,
    htmlLink: event.htmlLink ?? null,
    googleColorId: event.colorId ?? null,
  }
}

async function getGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.token

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = formatPrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)

  if (!clientEmail || !privateKey) {
    throw new Error('Google Calendar service account environment variables are not configured')
  }

  const assertion = signJwt({
    iss: clientEmail,
    scope: GOOGLE_CALENDAR_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }, privateKey)

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  const tokenBody = (await response.json()) as GoogleTokenResponse
  if (!response.ok || !tokenBody.access_token) {
    throw new Error(
      tokenBody.error_description ??
      tokenBody.error ??
      `Unable to authenticate with Google Calendar (${response.status})`
    )
  }

  cachedToken = {
    token: tokenBody.access_token,
    expiresAt: now + (tokenBody.expires_in ?? 3600),
  }

  return cachedToken.token
}

function signJwt(payload: Record<string, string | number>, privateKey: string) {
  const header = { alg: 'RS256', typ: 'JWT' }
  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`
  const signature = crypto.createSign('RSA-SHA256').update(unsignedToken).sign(privateKey)
  return `${unsignedToken}.${base64Url(signature)}`
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function formatPrivateKey(value?: string) {
  if (!value) return undefined
  return value
    .replace(/^"|"$/g, '')
    .replace(/\\n/g, '\n')
}

function formatGoogleApiError(fallback: string, status: number, error?: GoogleCalendarListResponse['error']) {
  const details = [error?.status, error?.message].filter(Boolean).join(': ')
  return details ? `${fallback} (${status}): ${details}` : `${fallback} (${status})`
}

function htmlToPlainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
