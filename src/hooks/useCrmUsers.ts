'use client'

import { useApiResource } from './useApiResource'

export interface CrmUserLite {
  id: string
  display_name: string | null
  email: string
}

export function useCrmUsers() {
  return useApiResource<CrmUserLite[]>('/api/marketing/users')
}
