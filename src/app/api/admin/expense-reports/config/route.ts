import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const adminClient = createAdminClient()
  const { data } = await adminClient.from('users').select('id, is_admin').eq('google_id', user.id).single()
  return data?.is_admin ? data : null
}

// GET /api/admin/expense-reports/config
export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  const { data: config, error } = await adminClient
    .from('expense_report_config')
    .select('id, reviewer_user_id, template_instructions, updated_at, updated_by')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let reviewer = null
  if (config?.reviewer_user_id) {
    const { data } = await adminClient
      .from('users')
      .select('id, display_name, email')
      .eq('id', config.reviewer_user_id)
      .single()
    reviewer = data
  }

  return NextResponse.json({ config: { ...config, reviewer } })
}

// PUT /api/admin/expense-reports/config
// Body: { reviewer_user_id?, template_instructions? }
export async function PUT(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const adminClient = createAdminClient()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: admin.id }
  if ('reviewer_user_id' in body) updates.reviewer_user_id = body.reviewer_user_id || null
  if ('template_instructions' in body) updates.template_instructions = body.template_instructions || null

  const { data, error } = await adminClient
    .from('expense_report_config')
    .update(updates)
    .not('id', 'is', null)
    .select('id, reviewer_user_id, template_instructions, updated_at, updated_by')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}
