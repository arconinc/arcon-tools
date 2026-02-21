import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthHeader } from '@/lib/credentials'
import { listOrders } from '@/lib/promobuillit/api'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId')
  const query = searchParams.get('q') ?? ''
  const page = parseInt(searchParams.get('page') ?? '0')

  if (!storeId) return NextResponse.json({ error: 'storeId is required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient.from('users').select('id').eq('google_id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const authHeader = await getAuthHeader(appUser.id)
  if (!authHeader) return NextResponse.json({ error: 'PromoBullit credentials not configured' }, { status: 400 })

  try {
    const result = await listOrders(storeId, authHeader, page)

    // Filter client-side by query (order ID, customer name, or email)
    let records = result.records
    if (query) {
      const q = query.toLowerCase()
      records = records.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          (o.customerName ?? '').toLowerCase().includes(q) ||
          (o.companyName ?? '').toLowerCase().includes(q)
      )
    }

    return NextResponse.json({ records, meta: result.meta })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
