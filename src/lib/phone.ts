/**
 * Format a raw phone string to (NNN) NNN-NNNN.
 * Handles 10-digit US numbers and 11-digit numbers with leading 1.
 * Returns null if the input cannot be normalized to 10 digits.
 */
export function formatPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  const ten = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits
  if (ten.length !== 10) return null
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
}

/**
 * Format phone input progressively as the user types.
 * Strips non-digits, limits to 10 digits, and builds the mask incrementally.
 * Safe to use directly in onChange handlers.
 */
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}
