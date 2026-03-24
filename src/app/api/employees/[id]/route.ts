import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('users')
    .select(`
      id, email, display_name, job_title, team, office_location, employment_type,
      profile_image_url, avatar_url, start_date,
      phone, linkedin_url, timezone,
      bio_html, bio_json, skills, interests,
      manager_id
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch manager and direct reports separately (self-referential joins are unreliable in PostgREST)
  const [managerResult, directReportsResult] = await Promise.all([
    data.manager_id
      ? adminClient.from('users').select('id, display_name, job_title, profile_image_url, avatar_url').eq('id', data.manager_id).single()
      : Promise.resolve({ data: null }),
    adminClient.from('users')
      .select('id, email, display_name, job_title, team, office_location, employment_type, profile_image_url, avatar_url, start_date')
      .eq('manager_id', id)
      .order('display_name'),
  ])

  return NextResponse.json({
    ...data,
    manager: managerResult.data ?? null,
    direct_reports: directReportsResult.data ?? [],
  })
}
