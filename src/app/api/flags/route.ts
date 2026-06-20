import { createFlagsDiscoveryEndpoint, getProviderData } from 'flags/next'
import { expenseReportsFlag } from '@/lib/flags'

export const GET = createFlagsDiscoveryEndpoint(
  () => getProviderData({ expenseReportsFlag })
)
