export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { accessRequestApproved, accessRequestDenied } from '@/lib/notifications/registry'

// GET /api/admin/access-requests — list all requests (admin only)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  if (!dbUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status') ?? 'pending'

  const { data } = await adminClient
    .from('access_requests')
    .select(`
      id, status, resource_type, resource_key, message, review_note, created_at, reviewed_at,
      groups!access_requests_group_id_fkey(id, key, name, color),
      requester:requester_id(id, display_name, email, avatar_url, profile_image_url),
      reviewer:reviewed_by(id, display_name)
    `)
    .eq('status', status)
    .order('created_at', { ascending: false })

  return NextResponse.json((data ?? []).map((request) => ({
    ...request,
    roles: (() => {
      const group = Array.isArray(request.groups) ? request.groups[0] : request.groups
      return group ? { id: group.id, name: group.key, label: group.name, color: group.color } : null
    })(),
  })))
}

// PUT /api/admin/access-requests — approve or deny a request
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('id, display_name, is_admin')
    .eq('google_id', user.id)
    .single()
  if (!dbUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const { request_id, action, review_note } = body ?? {}

  if (!request_id || !['approved', 'denied'].includes(action)) {
    return NextResponse.json({ error: 'request_id and action (approved|denied) are required' }, { status: 400 })
  }

  const { data: request } = await adminClient
    .from('access_requests')
    .select('id, requester_id, group_id, status, groups!access_requests_group_id_fkey(id, key, name)')
    .eq('id', request_id)
    .single()

  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  if (request.status !== 'pending') {
    return NextResponse.json({ error: 'Request is no longer pending' }, { status: 409 })
  }

  const group = (Array.isArray(request.groups) ? request.groups[0] : request.groups) as { id: string; key: string; name: string } | null
  if (!group) return NextResponse.json({ error: 'Access group not found' }, { status: 404 })

  // Update request status
  await adminClient
    .from('access_requests')
    .update({
      status: action,
      reviewed_by: dbUser.id,
      reviewed_at: new Date().toISOString(),
      review_note: review_note?.trim() || null,
    })
    .eq('id', request_id)

  if (action === 'approved') {
    // Grant the access group (ignore conflict if they already have it)
    await adminClient
      .from('group_memberships')
      .upsert({ user_id: request.requester_id, group_id: group.id, source: 'manual', assigned_by: dbUser.id }, { onConflict: 'group_id,user_id' })

    await dispatchNotification({
      definition: accessRequestApproved,
      payload: {
        request_id,
        role_label: group.name,
        reviewer_name: dbUser.display_name,
        review_note: review_note?.trim() || null,
      },
      recipientSpec: { userId: request.requester_id },
    })
  } else {
    await dispatchNotification({
      definition: accessRequestDenied,
      payload: {
        request_id,
        role_label: group.name,
        reviewer_name: dbUser.display_name,
        review_note: review_note?.trim() || null,
      },
      recipientSpec: { userId: request.requester_id },
    })
  }

  return NextResponse.json({ ok: true })
}
