// RBAC permission map.
// The app is open by default — all authenticated users have access to everything
// unless a resource is listed here. Adding a resource here restricts it to the
// specified role. Admins always bypass all checks.

export type ResourceKey =
  | `page:${string}`     // route prefix matched by startsWith
  | `section:${string}`  // named section key used in <RoleGate>
  | `file:${string}`     // 'file:bucket:<name>' — private Supabase Storage bucket

// Maps restricted resource → access group key required to access it.
// Resources NOT listed here are open to all authenticated users.
export const RESTRICTED_RESOURCES: Partial<Record<string, string>> = {
  // Financial documents
  'page:/accounting/financials': 'access:owner_access',
  'section:dashboard:financials': 'access:owner_access',
  'file:bucket:financial-reports': 'access:accounting_access',

  // HR sensitive documents (SSN, bank info, etc.)
  'page:/hr/documents': 'access:hr_access',
  'section:dashboard:hr-documents': 'access:hr_access',
  'file:bucket:hr-documents': 'access:hr_access',

  // HR-only pages
  'page:/hr/tasks': 'access:hr_access',
  'page:/hr/pto/requests': 'access:hr_access',
}

// Private Supabase Storage buckets — files are served via signed URL only.
// Must align with RESTRICTED_RESOURCES entries above.
export const PRIVATE_BUCKETS = new Set([
  'financial-reports',
  'hr-documents',
])
