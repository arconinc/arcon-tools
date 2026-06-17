// RBAC permission map.
// The app is open by default — all authenticated users have access to everything
// unless a resource is listed here. Adding a resource here restricts it to the
// specified role. Admins always bypass all checks.

export type ResourceKey =
  | `page:${string}`     // route prefix matched by startsWith
  | `section:${string}`  // named section key used in <RoleGate>
  | `file:${string}`     // 'file:bucket:<name>' — private Supabase Storage bucket

// Maps restricted resource → role name required to access it.
// Resources NOT listed here are open to all authenticated users.
export const RESTRICTED_RESOURCES: Partial<Record<string, string>> = {
  // Financial documents
  'page:/accounting/financials': 'accounting',
  'section:dashboard:financials': 'accounting',
  'file:bucket:financial-reports': 'accounting',

  // HR sensitive documents (SSN, bank info, etc.)
  'page:/hr/documents': 'hr',
  'section:dashboard:hr-documents': 'hr',
  'file:bucket:hr-documents': 'hr',

  // HR-only pages
  'page:/hr/tasks': 'hr',
  'page:/hr/pto/requests': 'hr',
}

// Private Supabase Storage buckets — files are served via signed URL only.
// Must align with RESTRICTED_RESOURCES entries above.
export const PRIVATE_BUCKETS = new Set([
  'financial-reports',
  'hr-documents',
])
