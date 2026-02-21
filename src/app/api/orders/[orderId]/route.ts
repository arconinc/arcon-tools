import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthHeader } from '@/lib/credentials'
import { getOrderDetail, getOrderProducts } from '@/lib/promobuillit/api'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get('storeId')
  if (!storeId) return NextResponse.json({ error: 'storeId is required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient.from('users').select('id').eq('google_id', user.id).single()
  if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const authHeader = await getAuthHeader(appUser.id)
  if (!authHeader) return NextResponse.json({ error: 'PromoBullit credentials not configured' }, { status: 400 })

  try {
    const [detail, products] = await Promise.all([
      getOrderDetail(storeId, orderId, authHeader),
      getOrderProducts(storeId, orderId, authHeader),
    ])
    return NextResponse.json({ detail, products })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
