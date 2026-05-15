import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthHeader } from '@/lib/credentials'
import { listStores, UducatStore } from '@/lib/promobuillit/api'

function toRow(s: UducatStore) {
  return {
    store_id: s.id,
    store_name: s.name,
    domain: s.domain ?? null,
    launch_date: s.startDate ?? null,
    takedown_date: s.endDate ?? null,
    is_active: s.isActive,
    in_production: s.isInProduction,
    last_order_at: s.lastOrder ?? null,
  }
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('is_admin, id')
    .eq('google_id', user.id)
    .single()
  if (!dbUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const authHeader = await getAuthHeader(dbUser.id)
  if (!authHeader) {
    return NextResponse.json(
      { error: 'No PromoBullit credentials configured. Set them up in your profile settings.' },
      { status: 422 }
    )
  }

  let remoteStores: UducatStore[]
  try {
    remoteStores = await listStores(authHeader)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to fetch stores from Uducat: ${msg}` }, { status: 502 })
  }

  // Partition into new vs existing based on store_id
  const { data: existing } = await adminClient.from('stores').select('store_id')
  const existingIds = new Set((existing ?? []).map((s: { store_id: string }) => String(s.store_id)))

  const toInsert = remoteStores.filter(s => !existingIds.has(s.id))
  const toUpdate = remoteStores.filter(s => existingIds.has(s.id))

  let insertError: string | null = null
  let updateError: string | null = null

  if (toInsert.length > 0) {
    const { error } = await adminClient.from('stores').insert(toInsert.map(toRow))
    if (error) insertError = error.message
  }

  // Update Uducat-sourced fields only; preserve locally-managed fields (store_types, etc.)
  for (const s of toUpdate) {
    const { error } = await adminClient
      .from('stores')
      .update({
        store_name: s.name,
        domain: s.domain ?? null,
        launch_date: s.startDate ?? null,
        takedown_date: s.endDate ?? null,
        is_active: s.isActive,
        in_production: s.isInProduction,
        last_order_at: s.lastOrder ?? null,
      })
      .eq('store_id', s.id)
    if (error) { updateError = error.message; break }
  }

  if (insertError || updateError) {
    return NextResponse.json(
      { error: insertError ?? updateError },
      { status: 500 }
    )
  }

  return NextResponse.json({
    added: toInsert.length,
    updated: toUpdate.length,
    total: remoteStores.length,
  })
}
