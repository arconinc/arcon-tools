import type { GroupCapabilityKey } from '@/types'

export const OPPORTUNITY_OWNERS_GROUP_KEY = 'sales'

export const GROUP_CAPABILITIES = {
  ACCESS_CONTROL: 'access_control',
  ASSIGNMENT_POOL: 'assignment_pool',
} as const satisfies Record<string, GroupCapabilityKey>

export const GROUP_CAPABILITY_KEYS = Object.values(GROUP_CAPABILITIES)

export const GROUP_CAPABILITY_LABELS: Record<GroupCapabilityKey, string> = {
  access_control: 'Access Control',
  assignment_pool: 'Assignment Pool',
}
