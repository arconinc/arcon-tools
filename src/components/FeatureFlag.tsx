'use client'

import { useFeatureFlags } from '@/components/layout/AppShell'

export function FeatureFlag({ name, children }: { name: string; children: React.ReactNode }) {
  const flags = useFeatureFlags()
  if (!flags[name]) return null
  return <>{children}</>
}
