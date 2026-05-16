import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: 'dateFrom and dateTo are required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .rpc('get_store_order_stats', {
      date_from: `${dateFrom}T00:00:00.000Z`,
      date_to:   `${dateTo}T23:59:59.999Z`,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const stats: Record<string, { count: number; total: number }> = {}
  for (const row of data ?? []) {
    stats[row.store_id] = {
      count: Number(row.order_count),
      total: Number(row.total_amount),
    }
  }

  return NextResponse.json(stats)
}
