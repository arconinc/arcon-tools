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

// GET /api/admin/expense-reports — list all reports (admin only)
// ?status=submitted|revision_requested|completed  ?month=YYYY-MM  ?user_id=  ?q=<name search>
export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const month = searchParams.get('month')
  const userId = searchParams.get('user_id')

  const adminClient = createAdminClient()

  let query = adminClient
    .from('expense_reports')
    .select('id, created_by, period_month, status, drive_file_id, drive_url, reviewer_comment, created_at, updated_at')
    .order('period_month', { ascending: false })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (month) query = query.eq('period_month', month)
  if (userId) query = query.eq('created_by', userId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with submitter names
  const reports = data ?? []
  const userIds = [...new Set(reports.map((r) => r.created_by as string))]
  const { data: users } = userIds.length
    ? await adminClient.from('users').select('id, display_name, email').in('id', userIds)
    : { data: [] }
  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]))

  const enriched = reports.map((r: Record<string, unknown>) => ({
    ...r,
    submitter: userMap[r.created_by as string] ?? null,
  }))

  return NextResponse.json({ reports: enriched })
}
