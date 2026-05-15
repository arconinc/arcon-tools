import {
  PromoOrdersResponse,
  PromoOrderDetail,
  PromoOrderProduct,
  ShipmentPayload,
  NotificationEmailPayload,
} from '@/types'

const BASE_URL = 'https://manage.promobullitstores.com'
const TIMEOUT_MS = 15000

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

function promoHeaders(authHeader: string): HeadersInit {
  return {
    'X-Auth-Credentials': authHeader,
    'Content-Type': 'application/json',
  }
}

// ─── Orders ──────────────────────────────────────────────────────────────────

async function fetchOrdersPage(
  storeId: string,
  authHeader: string,
  page: number,
  createdFrom?: string
): Promise<PromoOrdersResponse> {
  let url = `${BASE_URL}/admin/rest2/1/stores/${storeId}/orders?meta[pageSize]=100&meta[page]=${page}`
  if (createdFrom) url += `&createdFrom=${createdFrom}`
  const res = await fetchWithTimeout(url, { headers: promoHeaders(authHeader) })
  if (!res.ok) {
    throw new Error(`PromoBullit API error ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export async function listOrders(
  storeId: string,
  authHeader: string,
  opts: { createdFrom?: string } = {}
): Promise<import('@/types').PromoOrder[]> {
  const first = await fetchOrdersPage(storeId, authHeader, 0, opts.createdFrom)
  const total = parseInt(first.meta.recordsFound, 10)
  const pageSize = parseInt(first.meta.pageSize, 10)
  const all = [...first.records]

  if (total > pageSize) {
    const pageCount = Math.ceil(total / pageSize)
    for (let p = 1; p < pageCount; p++) {
      const page = await fetchOrdersPage(storeId, authHeader, p, opts.createdFrom)
      all.push(...page.records)
    }
  }

  return all
}

export async function getOrderDetail(
  storeId: string,
  orderId: string,
  authHeader: string
): Promise<PromoOrderDetail> {
  const url = `${BASE_URL}/admin/rest2/1/stores/${storeId}/orders/${orderId}`
  const res = await fetchWithTimeout(url, { headers: promoHeaders(authHeader) })
  if (!res.ok) {
    throw new Error(`PromoBullit API error ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export async function getOrderProducts(
  storeId: string,
  orderId: string,
  authHeader: string
): Promise<PromoOrderProduct[]> {
  const url = `${BASE_URL}/admin/rest2/1/stores/${storeId}/orders/${orderId}/products`
  const res = await fetchWithTimeout(url, { headers: promoHeaders(authHeader) })
  if (!res.ok) {
    throw new Error(`PromoBullit API error ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

// ─── Shipments ────────────────────────────────────────────────────────────────

export async function addShipment(
  storeId: string,
  orderId: string,
  payload: ShipmentPayload,
  authHeader: string
): Promise<{ id: string }> {
  const url = `${BASE_URL}/admin/rest2/1/stores/${storeId}/orders/${orderId}/shipments`
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: promoHeaders(authHeader),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`PromoBullit API error ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

// ─── Notification Email ───────────────────────────────────────────────────────

export async function sendNotificationEmail(
  storeId: string,
  orderId: string,
  payload: NotificationEmailPayload,
  authHeader: string
): Promise<void> {
  const url = `${BASE_URL}/admin/rest2/1/stores/${storeId}/orders/${orderId}`
  const res = await fetchWithTimeout(url, {
    method: 'PUT',
    headers: promoHeaders(authHeader),
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`PromoBullit API error ${res.status}: ${await res.text()}`)
  }
}

// ─── Stores ──────────────────────────────────────────────────────────────────

export interface UducatStore {
  id: string
  name: string
  domain: string | null
  startDate: string | null
  endDate: string | null
  isActive: boolean
  isInProduction: boolean
  created: string | null
  lastOrder: string | null
}

interface StoresPage {
  records: UducatStore[]
  meta: { recordsFound: string; page: string; pageSize: string }
}

function storesHeaders(authHeader: string): HeadersInit {
  return {
    'Authorization': `Basic ${authHeader}`,
    'Accept': 'application/json',
  }
}

async function fetchStoresPage(authHeader: string, page: number): Promise<StoresPage> {
  const url = `${BASE_URL}/admin/rest2/1/stores?storeStatus=all&meta%5BpageSize%5D=100&meta%5Bpage%5D=${page}`
  const res = await fetchWithTimeout(url, { headers: storesHeaders(authHeader) })
  if (!res.ok) {
    throw new Error(`PromoBullit API error ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export async function listStores(authHeader: string): Promise<UducatStore[]> {
  const first = await fetchStoresPage(authHeader, 0)
  const total = parseInt(first.meta.recordsFound, 10)
  const pageSize = parseInt(first.meta.pageSize, 10)
  const all = [...first.records]

  if (total > pageSize) {
    const pageCount = Math.ceil(total / pageSize)
    for (let p = 1; p < pageCount; p++) {
      const page = await fetchStoresPage(authHeader, p)
      all.push(...page.records)
    }
  }

  return all
}

// ─── Credential Validation ────────────────────────────────────────────────────

export async function validateCredentials(authHeader: string): Promise<boolean> {
  // Use a lightweight endpoint — just try to reach the API root with this auth
  // We attempt to list orders from any store; a 401 means bad creds, 200 means good
  // Since we don't know a valid store ID yet, we hit the base path and check for non-401
  try {
    const url = `${BASE_URL}/admin/rest2/1/stores/test/orders?meta[pageSize]=20`
    const res = await fetchWithTimeout(url, { headers: promoHeaders(authHeader) })
    // 401 = bad credentials, anything else (including 404 for bad store) = credentials work
    return res.status !== 401
  } catch {
    return false
  }
}
