import { RESTRICTED_RESOURCES } from './permissions'

// Returns true if the user can access the given page (matched by route prefix).
// Admins always pass. Resources not listed in RESTRICTED_RESOURCES always pass.
export function hasPageAccess(roles: string[], isAdmin: boolean, pathname: string): boolean {
  if (isAdmin) return true
  for (const [resource, requiredRole] of Object.entries(RESTRICTED_RESOURCES)) {
    if (!requiredRole || !resource.startsWith('page:')) continue
    const prefix = resource.slice('page:'.length)
    if (pathname === prefix || pathname.startsWith(prefix + '/') || pathname.startsWith(prefix + '?')) {
      return roles.includes(requiredRole)
    }
  }
  return true
}

// Returns true if the user can see the given named section.
export function hasSectionAccess(roles: string[], isAdmin: boolean, section: string): boolean {
  if (isAdmin) return true
  const key = `section:${section}`
  const requiredRole = RESTRICTED_RESOURCES[key]
  if (!requiredRole) return true
  return roles.includes(requiredRole)
}

// Returns true if the user can access files in the given private bucket/path.
export function hasFileAccess(roles: string[], isAdmin: boolean, bucket: string): boolean {
  if (isAdmin) return true
  const key = `file:bucket:${bucket}`
  const requiredRole = RESTRICTED_RESOURCES[key]
  if (!requiredRole) return true
  return roles.includes(requiredRole)
}

// Returns the role required for a given resource key, or null if unrestricted.
export function requiredRoleFor(resource: string): string | null {
  return RESTRICTED_RESOURCES[resource] ?? null
}
