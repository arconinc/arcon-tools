export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { accessRequestNew } from '@/lib/notifications/registry'

// POST /api/access-requests — submit an access request
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, display_name, is_admin')
    .eq('google_id', user.id)
    .single()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { role_id, resource_type, resource_key, message } = body ?? {}

  if (!role_id) return NextResponse.json({ error: 'role_id is required' }, { status: 400 })

  // Look up role label for notification
  const { data: role } = await adminClient
    .from('roles')
    .select('id, name, label')
    .eq('id', role_id)
    .single()
  if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 })

  // Check if user already has this role
  const { data: existing } = await adminClient
    .from('user_roles')
    .select('id')
    .eq('user_id', appUser.id)
    .eq('role_id', role_id)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'You already have this role' }, { status: 409 })
  }

  // Check for an already-pending request
  const { data: pending } = await adminClient
    .from('access_requests')
    .select('id')
    .eq('requester_id', appUser.id)
    .eq('role_id', role_id)
    .eq('status', 'pending')
    .maybeSingle()
  if (pending) {
    return NextResponse.json({ error: 'You already have a pending request for this role' }, { status: 409 })
  }

  const { data: request, error } = await adminClient
    .from('access_requests')
    .insert({
      requester_id: appUser.id,
      role_id,
      resource_type: resource_type ?? null,
      resource_key: resource_key ?? null,
      message: message?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !request) {
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
  }

  // Notify all admins
  await dispatchNotification({
    definition: accessRequestNew,
    payload: {
      request_id: request.id,
      requester_name: appUser.display_name,
      role_label: role.label,
      resource_key: resource_key ?? null,
      message: message?.trim() || null,
    },
    recipientSpec: { admins: true },
    suppressUserIds: appUser.is_admin ? [appUser.id] : [],
  })

  return NextResponse.json({ id: request.id })
}

// GET /api/access-requests — list current user's requests
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id')
    .eq('google_id', user.id)
    .single()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await adminClient
    .from('access_requests')
    .select('id, status, message, review_note, created_at, reviewed_at, roles(name, label, color)')
    .eq('requester_id', appUser.id)
    .order('created_at', { ascending: false })

  return NextResponse.json(data ?? [])
}
