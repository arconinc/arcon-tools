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

async function attachGroupDetails(groups: Group[]): Promise<GroupResponse[]> {
  if (groups.length === 0) return []

  const adminClient = createAdminClient()
  const groupIds = groups.map((group) => group.id)
  const [{ data: capabilities, error: capabilitiesError }, { data: memberships, error: membershipsError }] = await Promise.all([
    adminClient.from('group_capabilities').select('id, group_id, capability, config, created_at').in('group_id', groupIds),
    adminClient.from('group_memberships').select('group_id').in('group_id', groupIds),
  ])

  if (capabilitiesError) throw new Error(capabilitiesError.message)
  if (membershipsError) throw new Error(membershipsError.message)

  const capabilitiesByGroup = new Map<string, GroupCapability[]>()
  for (const capability of capabilities ?? []) {
    const list = capabilitiesByGroup.get(capability.group_id) ?? []
    list.push(capability as GroupCapability)
    capabilitiesByGroup.set(capability.group_id, list)
  }

  const memberCounts = new Map<string, number>()
  for (const membership of memberships ?? []) {
    memberCounts.set(membership.group_id, (memberCounts.get(membership.group_id) ?? 0) + 1)
  }

  return groups.map((group) => ({
    ...group,
    capabilities: capabilitiesByGroup.get(group.id) ?? [],
    member_count: memberCounts.get(group.id) ?? 0,
  }))
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

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const includeInactive = searchParams.get('include_inactive') === 'true'

  const adminClient = createAdminClient()
  let query = adminClient.from('groups').select(GROUP_SELECT).order('sort_order').order('name')
  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    return NextResponse.json(await attachGroupDetails((data ?? []) as Group[]))
  } catch (detailError) {
    return NextResponse.json({ error: detailError instanceof Error ? detailError.message : 'Failed to load group details' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const key = typeof body.key === 'string' ? body.key.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const capabilities = body.capabilities === undefined ? [] : normalizeCapabilities(body.capabilities)

  if (!key || !name) return NextResponse.json({ error: 'key and name are required' }, { status: 400 })
  if (capabilities === null) return NextResponse.json({ error: 'Invalid capabilities' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('groups')
    .insert({
      key,
      name,
      description: body.description ?? null,
      color: body.color ?? '#6b7280',
      is_system: false,
      is_active: body.is_active ?? true,
      sort_order: body.sort_order ?? 0,
      source_type: 'manual',
      source_id: null,
    })
    .select(GROUP_SELECT)
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A group with that key already exists' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const capabilityError = await replaceCapabilities(data.id, capabilities)
  if (capabilityError) return NextResponse.json({ error: capabilityError.message }, { status: 500 })

  try {
    const [group] = await attachGroupDetails([data as Group])
    return NextResponse.json(group, { status: 201 })
  } catch (detailError) {
    return NextResponse.json({ error: detailError instanceof Error ? detailError.message : 'Failed to load group details' }, { status: 500 })
  }
}
