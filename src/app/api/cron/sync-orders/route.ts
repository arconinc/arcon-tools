import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listOrders } from '@/lib/promobuillit/api'
import { PromoOrder } from '@/types'

export async function GET(request: Request) {
  // Vercel cron jobs send this header; also accept a Bearer CRON_SECRET for manual calls
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const isCronCall = request.headers.get('x-vercel-cron') === '1'

  if (!isCronCall) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const promoBullitAuth = process.env.PROMOBULLIT_AUTH
  if (!promoBullitAuth) {
    return NextResponse.json({ error: 'PROMOBULLIT_AUTH env var not set' }, { status: 500 })
  }

  const adminClient = createAdminClient()

  const { data: stores, error: storesError } = await adminClient
    .from('stores')
    .select('id, store_id, last_order_sync_at')
    .eq('is_active', true)

  if (storesError) return NextResponse.json({ error: storesError.message }, { status: 500 })
  if (!stores?.length) return NextResponse.json({ synced: 0, stores: 0 })

  let totalSynced = 0

  for (const store of stores) {
    try {
      const createdFrom = store.last_order_sync_at
        ? store.last_order_sync_at.slice(0, 10)
        : undefined

      const orders: PromoOrder[] = await listOrders(store.store_id, promoBullitAuth, { createdFrom })

      if (orders.length > 0) {
        const rows = orders.map(o => {
          const r = o as unknown as Record<string, unknown>
          return {
            store_id: store.id,
            order_id: o.id,
            created_at: o.created ? new Date(o.created).toISOString() : new Date().toISOString(),
            modified_at: o.modified ? new Date(o.modified).toISOString() : null,
            customer_name: o.customerName ?? null,
            company_name: o.companyName ?? null,
            salesrep_name: (r.salesrepName as string) ?? null,
            parent_id: (r.parentId as string) ?? null,
            language_id: (r.languageId as string) ?? null,
            currency_id: (r.currencyId as string) ?? null,
            on_ship_station: Boolean(r.onShipStation),
            issue_count: parseInt(String(r.issueCount ?? '0'), 10) || 0,
            attachment_count: parseInt(String(r.attachmentCount ?? '0'), 10) || 0,
            status: o.status ?? null,
            amount: parseFloat(o.amount) || 0,
            amount_str: (r.amount_str as string) ?? null,
            internal_notes: (r.internalNotes as string) ?? null,
            details: o.details ?? null,
            synced_at: new Date().toISOString(),
          }
        })

        const { error: upsertError } = await adminClient
          .from('store_order_summaries')
          .upsert(rows, { onConflict: 'store_id,order_id' })

        if (upsertError) {
          console.error(`Cron: order upsert error for store ${store.store_id}:`, upsertError.message)
          continue
        }

        totalSynced += orders.length
      }

      await adminClient
        .from('stores')
        .update({ last_order_sync_at: new Date().toISOString() })
        .eq('id', store.id)
    } catch (err) {
      console.error(`Cron: failed to sync orders for store ${store.store_id}:`, err)
    }
  }

  return NextResponse.json({ synced: totalSynced, stores: stores.length })
}
