import { RESTRICTED_RESOURCES } from './permissions'

// ─── Document fine-grained access ────────────────────────────────────────────

export interface DocumentAccessContext {
  ownerId: string | null
  requiredRole: string | null  // legacy field — honored for backward compat
  departmentGrants: string[]
  userGrants: string[]         // user IDs explicitly granted
}

// Returns true if the given user may open/download the document.
// Admins are NOT special-cased — they go through the same checks as everyone else.
export function canAccessDocument(
  ctx: DocumentAccessContext,
  user: { id: string; roles: string[]; department: string[] | null }
): boolean {
  // Owner always has access
  if (ctx.ownerId === user.id) return true

  // If no explicit permissions have ever been configured, treat as open (backward compat)
  const hasExplicit =
    ctx.ownerId !== null ||
    ctx.departmentGrants.length > 0 ||
    ctx.userGrants.length > 0 ||
    ctx.requiredRole !== null
  if (!hasExplicit) return true

  // Legacy required_role check (for documents created before this system)
  if (ctx.requiredRole && user.roles.includes(ctx.requiredRole)) return true

  // Individual user grant
  if (ctx.userGrants.includes(user.id)) return true

  // Department grant — user must belong to at least one granted department
  if (ctx.departmentGrants.length > 0 && user.department) {
    if (ctx.departmentGrants.some(d => (user.department as string[]).includes(d))) return true
  }

  return false
}

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
