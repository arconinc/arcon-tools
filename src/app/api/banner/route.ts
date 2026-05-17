import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — return published slides only (any authenticated user)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('banner_config')
    .select('slides_json')
    .eq('status', 'published')
    .single()

  if (error) return NextResponse.json({ slides: [] }, { status: 200 })
  return NextResponse.json({ slides: data.slides_json ?? [] })
}
