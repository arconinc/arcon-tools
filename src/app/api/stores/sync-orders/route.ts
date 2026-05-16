import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthHeader } from '@/lib/credentials'
import { listOrders } from '@/lib/promobuillit/api'
import { PromoOrder } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id')
    .eq('google_id', user.id)
    .single()
  if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const authHeader = await getAuthHeader(appUser.id)
  if (!authHeader) {
    return NextResponse.json(
      { error: 'No PromoBullit credentials configured. Add your credentials in Settings.' },
      { status: 400 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const filterStoreId: string | undefined = body.store_id

  let storeQuery = adminClient
    .from('stores')
    .select('id, store_id')
    .eq('is_active', true)

  if (filterStoreId) {
    storeQuery = storeQuery.eq('id', filterStoreId)
  }

  const { data: stores, error: storesError } = await storeQuery
  if (storesError) return NextResponse.json({ error: storesError.message }, { status: 500 })
  if (!stores?.length) return NextResponse.json({ synced: 0, stores: 0 })

  // Sync from Jan 1 of the previous year so full two-year history is captured.
  // The upsert on (store_id, order_id) handles deduplication.
  const syncFrom = `${new Date().getFullYear() - 1}-01-01`

  let totalSynced = 0

  for (const store of stores) {
    try {
      const orders: PromoOrder[] = await listOrders(store.store_id, authHeader, { createdFrom: syncFrom })

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
          console.error(`Order upsert error for store ${store.store_id}:`, upsertError.message)
          continue
        }

        totalSynced += orders.length
      }

      await adminClient
        .from('stores')
        .update({ last_order_sync_at: new Date().toISOString() })
        .eq('id', store.id)
    } catch (err) {
      console.error(`Failed to sync orders for store ${store.store_id}:`, err)
    }
  }

  return NextResponse.json({ synced: totalSynced, stores: stores.length })
}
