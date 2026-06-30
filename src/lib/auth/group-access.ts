import type { SupabaseClient } from '@supabase/supabase-js'

export const ACCESS_GROUP_KEYS = [
  'access:accounting_access',
  'access:hr_access',
  'access:owner_access',
  'access:accounting_lead_access',
] as const

export type AccessGroupKey = typeof ACCESS_GROUP_KEYS[number]

export const LEGACY_ROLE_TO_ACCESS_GROUP: Record<string, AccessGroupKey> = {
  accounting: 'access:accounting_access',
  accounting_access: 'access:accounting_access',
  hr: 'access:hr_access',
  hr_access: 'access:hr_access',
  owner_access: 'access:owner_access',
  accounting_lead_access: 'access:accounting_lead_access',
}

export const ACCESS_GROUP_TO_LEGACY_ROLE: Record<AccessGroupKey, string> = {
  'access:accounting_access': 'accounting_access',
  'access:hr_access': 'hr_access',
  'access:owner_access': 'owner_access',
  'access:accounting_lead_access': 'accounting_lead_access',
}

export const ASSIGNMENT_GROUP_BY_DEPARTMENT: Record<string, string | null> = {
  Accounting: 'accounting',
  CRM: 'sales',
  Sales: 'sales',
  Marketing: 'marketing',
  HR: 'hr',
  Warehouse: 'warehouse',
  'E-Commerce': 'ecommerce',
  IT: 'it',
  General: null,
}

export const DEPARTMENT_BY_ASSIGNMENT_GROUP: Record<string, string> = {
  accounting: 'Accounting',
  sales: 'Sales',
  marketing: 'Marketing',
  hr: 'HR',
  warehouse: 'Warehouse',
  ecommerce: 'E-Commerce',
  it: 'IT',
}

type GroupMembershipRow = {
  group_id: string
  groups: { key: string; is_active: boolean } | { key: string; is_active: boolean }[] | null
}

type GroupCapabilityRow = {
  group_id: string
  capability: 'access_control' | 'assignment_pool'
}

function rowGroup(row: GroupMembershipRow) {
  return Array.isArray(row.groups) ? row.groups[0] : row.groups
}

export function normalizeAccessGroupKey(value: string | null | undefined): AccessGroupKey | null {
  if (!value) return null
  if ((ACCESS_GROUP_KEYS as readonly string[]).includes(value)) return value as AccessGroupKey
  return LEGACY_ROLE_TO_ACCESS_GROUP[value] ?? null
}

export function normalizeAccessGroupKeys(values: string[]) {
  return [...new Set(values.map(normalizeAccessGroupKey).filter((value): value is AccessGroupKey => !!value))]
}

export async function getUserGroupKeys(
  adminClient: SupabaseClient,
  userId: string,
  capability: 'access_control' | 'assignment_pool'
) {
  const { data: memberships, error: membershipsError } = await adminClient
    .from('group_memberships')
    .select('group_id, groups!group_memberships_group_id_fkey!inner(key, is_active)')
    .eq('user_id', userId)

  if (membershipsError) throw new Error(membershipsError.message)

  const activeMemberships = ((memberships ?? []) as GroupMembershipRow[])
    .filter((row) => rowGroup(row)?.is_active)

  const groupIds = activeMemberships.map((row) => row.group_id)
  if (groupIds.length === 0) return []

  const { data: capabilities, error: capabilitiesError } = await adminClient
    .from('group_capabilities')
    .select('group_id, capability')
    .in('group_id', groupIds)
    .eq('capability', capability)

  if (capabilitiesError) throw new Error(capabilitiesError.message)

  const eligibleIds = new Set(((capabilities ?? []) as GroupCapabilityRow[]).map((row) => row.group_id))
  return [...new Set(
    activeMemberships
      .filter((row) => eligibleIds.has(row.group_id))
      .map((row) => rowGroup(row)?.key)
      .filter((key): key is string => !!key)
  )]
}

export async function getUserAccessGroupKeys(adminClient: SupabaseClient, userId: string) {
  return normalizeAccessGroupKeys(await getUserGroupKeys(adminClient, userId, 'access_control'))
}

export async function getUserAssignmentGroupKeys(adminClient: SupabaseClient, userId: string) {
  return getUserGroupKeys(adminClient, userId, 'assignment_pool')
}

export async function userHasAccessGroup(adminClient: SupabaseClient, userId: string, allowedGroups: string[]) {
  const normalized = normalizeAccessGroupKeys(allowedGroups)
  if (normalized.length === 0) return true
  const userGroups = await getUserAccessGroupKeys(adminClient, userId)
  return normalized.some((groupKey) => userGroups.includes(groupKey))
}
