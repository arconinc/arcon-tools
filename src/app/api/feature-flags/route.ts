import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FeatureFlag } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('feature_flags')
    .select('key, enabled')
    .order('key')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const flags: Record<string, boolean> = {}
  for (const row of (data as Pick<FeatureFlag, 'key' | 'enabled'>[])) {
    flags[row.key] = row.enabled
  }

  return NextResponse.json({ flags })
}
