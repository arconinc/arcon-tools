import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ClickUpTask } from '@/types'

// GET — fetch ClickUp tasks assigned to the current user
export async function GET() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  // Fetch app user record — select only stable columns so this works before the migration runs
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, email')
    .eq('google_id', authUser.id)
    .single()

  if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Try to read the cached clickup_user_id (column may not exist before migration)
  const { data: clickupCache } = await adminClient
    .from('users')
    .select('clickup_user_id')
    .eq('id', appUser.id)
    .single()

  // Fetch ClickUp config from ticker_config
  const { data: config } = await adminClient
    .from('ticker_config')
    .select('clickup_api_key')
    .single()

  // clickup_team_id may not exist before migration — fetch separately
  const { data: teamConfig } = await adminClient
    .from('ticker_config')
    .select('clickup_team_id')
    .single()

  if (!config?.clickup_api_key) {
    return NextResponse.json({ tasks: [], configured: false })
  }

  const apiKey = config.clickup_api_key as string
  const teamId: string | null = (teamConfig as { clickup_team_id?: string | null } | null)?.clickup_team_id ?? null
  let clickupUserId: string | null = (clickupCache as { clickup_user_id?: string | null } | null)?.clickup_user_id ?? null

  if (!teamId) {
    return NextResponse.json({
      tasks: [],
      configured: true,
      user_not_found: true,
      hint: 'Set a ClickUp Team ID in admin settings to enable per-user task lookup',
    })
  }

  // Resolve email → ClickUp user ID if not yet cached
  if (!clickupUserId) {
    clickupUserId = await resolveClickUpUserId(apiKey, teamId, appUser.email)
    if (clickupUserId) {
      await adminClient
        .from('users')
        .update({ clickup_user_id: clickupUserId })
        .eq('id', appUser.id)
    }
  }

  if (!clickupUserId) {
    return NextResponse.json({
      tasks: [],
      configured: true,
      user_not_found: true,
      hint: 'Email not found in ClickUp workspace',
    })
  }

  const tasks = await fetchUserTasks(apiKey, teamId, clickupUserId)
  return NextResponse.json({ tasks, configured: true })
}

// ── ClickUp helpers ────────────────────────────────────────────────────────────

async function resolveClickUpUserId(
  apiKey: string,
  teamId: string,
  email: string,
): Promise<string | null> {
  try {
    const res = await fetch(`https://api.clickup.com/api/v2/team/${teamId}`, {
      headers: { Authorization: apiKey },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = await res.json()
    const members: Array<{ user: { id: number; email?: string } }> = data.team?.members ?? []
    const match = members.find(
      (m) => m.user.email?.toLowerCase() === email.toLowerCase(),
    )
    return match ? String(match.user.id) : null
  } catch {
    return null
  }
}

async function fetchUserTasks(
  apiKey: string,
  teamId: string,
  clickupUserId: string,
): Promise<ClickUpTask[]> {
  try {
    const res = await fetch(
      `https://api.clickup.com/api/v2/team/${teamId}/task?assignees[]=${clickupUserId}&include_closed=false&order_by=due_date&page=0`,
      { headers: { Authorization: apiKey }, next: { revalidate: 300 } },
    )
    if (!res.ok) return []

    const data = await res.json()
    const raw: Array<{
      id: string
      name: string
      status?: { status: string }
      priority?: { id: string } | null
      due_date?: string | null
      url?: string
      list?: { name: string }
    }> = data.tasks ?? []

    return raw.slice(0, 20).map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status?.status ?? 'open',
      priority: mapPriority(t.priority?.id),
      due_date: t.due_date ?? null,
      url: t.url ?? `https://app.clickup.com/t/${t.id}`,
      list_name: t.list?.name ?? '',
    }))
  } catch {
    return []
  }
}

function mapPriority(id: string | undefined): ClickUpTask['priority'] {
  switch (id) {
    case '1': return 'urgent'
    case '2': return 'high'
    case '3': return 'normal'
    case '4': return 'low'
    default: return null
  }
}
