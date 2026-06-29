import type { GroupCapabilityKey } from '@/types'

export const OPPORTUNITY_OWNERS_GROUP_KEY = 'opportunity_owners'

export const GROUP_CAPABILITIES = {
  ACCESS_CONTROL: 'access_control',
  ASSIGNMENT_POOL: 'assignment_pool',
  DIRECTORY_GROUP: 'directory_group',
  NOTIFICATION_RECIPIENT: 'notification_recipient',
  TASK_ROUTING: 'task_routing',
} as const satisfies Record<string, GroupCapabilityKey>

export const GROUP_CAPABILITY_KEYS = Object.values(GROUP_CAPABILITIES)

export const GROUP_CAPABILITY_LABELS: Record<GroupCapabilityKey, string> = {
  access_control: 'Access',
  assignment_pool: 'Assignment Pool',
  directory_group: 'Directory',
  notification_recipient: 'Notification',
  task_routing: 'Task Routing',
}
