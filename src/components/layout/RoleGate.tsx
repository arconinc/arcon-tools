'use client'

import { useAppUser } from './AppShell'
import { hasSectionAccess } from '@/lib/access'

interface RoleGateProps {
  resource: string          // e.g. 'section:dashboard:financials'
  fallback?: React.ReactNode
  children: React.ReactNode
}

// Renders children when the current user has access to the given resource.
// Resources not listed in RESTRICTED_RESOURCES are always shown.
// Falls back to `fallback` (default: nothing) when access is denied.
export function RoleGate({ resource, fallback = null, children }: RoleGateProps) {
  const { user } = useAppUser()
  if (!user) return null

  const section = resource.startsWith('section:') ? resource.slice('section:'.length) : resource
  const allowed = hasSectionAccess(user.roles ?? [], user.is_admin, section)

  return allowed ? <>{children}</> : <>{fallback}</>
}
