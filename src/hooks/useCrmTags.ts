'use client'

import { useApiResource } from './useApiResource'

export interface CrmTagLite {
  id: string
  name: string
  color: string
}

export function useCrmTags() {
  return useApiResource<CrmTagLite[]>('/api/marketing/tags')
}
