const DEFAULT_READONLY = ['id', 'created_at', 'updated_at', 'created_by'] as const

/** Remove read-only + caller-specified keys from a request body before an update. */
export function stripReadOnly<T extends Record<string, unknown>>(
  body: T,
  extraKeys: string[] = [],
): Partial<T> {
  const drop = new Set<string>([...DEFAULT_READONLY, ...extraKeys])
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (!drop.has(k)) out[k] = v
  }
  return out as Partial<T>
}
