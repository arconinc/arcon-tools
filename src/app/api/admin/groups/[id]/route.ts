import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GROUP_CAPABILITY_KEYS } from '@/lib/groups/constants'
import type { Group, GroupCapability, GroupCapabilityKey } from '@/types'

type CapabilityInput = {
  capability: GroupCapabilityKey
  config?: Record<string, unknown>
}

type GroupResponse = Group & {
  capabilities: GroupCapability[]
  member_count: number
}

const GROUP_SELECT = 'id, key, name, description, color, is_system, is_active, sort_order, source_type, source_id, created_at, updated_at'

async function requireAdmin(googleId: string) {
  const adminClient = createAdminClient()
  const { data } = await adminClient.from('users').select('is_admin').eq('google_id', googleId).single()
  return data?.is_admin === true
}

function normalizeCapabilities(value: unknown): CapabilityInput[] | null {
  if (value === undefined) return null
  if (!Array.isArray(value)) return null

  const capabilities: CapabilityInput[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const capability = (item as { capability?: unknown }).capability
    if (typeof capability !== 'string' || !GROUP_CAPABILITY_KEYS.includes(capability as GroupCapabilityKey)) return null
    const config = (item as { config?: unknown }).config
    if (config !== undefined && (!config || typeof config !== 'object' || Array.isArray(config))) return null
    capabilities.push({ capability: capability as GroupCapabilityKey, config: (config as Record<string, unknown>) ?? {} })
  }
  return capabilities
}

async function attachGroupDetails(group: Group): Promise<GroupResponse> {
  const adminClient = createAdminClient()
  const [{ data: capabilities, error: capabilitiesError }, { count, error: countError }] = await Promise.all([
    adminClient.from('group_capabilities').select('id, group_id, capability, config, created_at').eq('group_id', group.id),
    adminClient.from('group_memberships').select('id', { count: 'exact', head: true }).eq('group_id', group.id),
  ])

  if (capabilitiesError) throw new Error(capabilitiesError.message)
  if (countError) throw new Error(countError.message)

  return {
    ...group,
    capabilities: (capabilities ?? []) as GroupCapability[],
    member_count: count ?? 0,
  }
}

async function replaceCapabilities(groupId: string, capabilities: CapabilityInput[]) {
  const adminClient = createAdminClient()
  const { error: deleteError } = await adminClient.from('group_capabilities').delete().eq('group_id', groupId)
  if (deleteError) return deleteError

  if (capabilities.length === 0) return null

  const { error } = await adminClient.from('group_capabilities').insert(
    capabilities.map((capability) => ({
      group_id: groupId,
      capability: capability.capability,
      config: capability.config ?? {},
    }))
  )
  return error
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const adminClient = createAdminClient()
  const { data, error } = await adminClient.from('groups').select(GROUP_SELECT).eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    return NextResponse.json(await attachGroupDetails(data as Group))
  } catch (detailError) {
    return NextResponse.json({ error: detailError instanceof Error ? detailError.message : 'Failed to load group details' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const capabilities = normalizeCapabilities(body.capabilities)
  if (capabilities === null && body.capabilities !== undefined) return NextResponse.json({ error: 'Invalid capabilities' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data: existing, error: existingError } = await adminClient.from('groups').select(GROUP_SELECT).eq('id', id).single()
  if (existingError || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (body.key !== undefined) updates.key = typeof body.key === 'string' ? body.key.trim() : body.key
  if (body.name !== undefined) updates.name = typeof body.name === 'string' ? body.name.trim() : body.name
  if (body.description !== undefined) updates.description = body.description
  if (body.color !== undefined) updates.color = body.color
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order

  const nextIsActive = body.deactivate === true ? false : body.is_active
  if (nextIsActive !== undefined) {
    if (existing.is_system && nextIsActive === false) {
      return NextResponse.json({ error: 'System groups cannot be deactivated' }, { status: 400 })
    }
    updates.is_active = nextIsActive
  }

  if (updates.key === '') return NextResponse.json({ error: 'key cannot be empty' }, { status: 400 })
  if (updates.name === '') return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })

  let group = existing as Group
  if (Object.keys(updates).length > 0) {
    const { data, error } = await adminClient
      .from('groups')
      .update(updates)
      .eq('id', id)
      .select(GROUP_SELECT)
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'A group with that key already exists' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    group = data as Group
  }

  if (capabilities !== null) {
    const capabilityError = await replaceCapabilities(id, capabilities)
    if (capabilityError) return NextResponse.json({ error: capabilityError.message }, { status: 500 })
  }

  try {
    return NextResponse.json(await attachGroupDetails(group))
  } catch (detailError) {
    return NextResponse.json({ error: detailError instanceof Error ? detailError.message : 'Failed to load group details' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const adminClient = createAdminClient()
  const { data: existing, error: existingError } = await adminClient.from('groups').select(GROUP_SELECT).eq('id', id).single()
  if (existingError || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.is_system) return NextResponse.json({ error: 'System groups cannot be deactivated' }, { status: 400 })

  const { data, error } = await adminClient
    .from('groups')
    .update({ is_active: false })
    .eq('id', id)
    .select(GROUP_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    return NextResponse.json(await attachGroupDetails(data as Group))
  } catch (detailError) {
    return NextResponse.json({ error: detailError instanceof Error ? detailError.message : 'Failed to load group details' }, { status: 500 })
  }
}
