// Default CSR for new spec samples. Matched by display name (same approach as aturian-assignees.ts).
export const DEFAULT_SPEC_CSR_NAME = 'Ella Wheatcraft'

export function findDefaultSpecCsrId(users: { id: string; display_name: string }[]): string {
  const target = DEFAULT_SPEC_CSR_NAME.toLowerCase()
  return users.find(u => u.display_name?.trim().toLowerCase() === target)?.id ?? ''
}
