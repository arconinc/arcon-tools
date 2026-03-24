import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  const adminClient = createAdminClient()
  let query = adminClient
    .from('users')
    .select('id, email, display_name, job_title, team, office_location, employment_type, profile_image_url, avatar_url, start_date')
    .order('display_name')

  if (q) {
    query = query.or(`display_name.ilike.%${q}%,job_title.ilike.%${q}%,team.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
