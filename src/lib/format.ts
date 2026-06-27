export function formatDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function formatRelative(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  const diffMs = Date.now() - d.getTime()
  const sec = Math.round(diffMs / 1000)
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)
  if (sec < 60) return 'just now'
  if (min < 60) return `${min}m ago`
  if (hr < 24) return `${hr}h ago`
  if (day < 30) return `${day}d ago`
  return formatDate(s)
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '—'
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function formatBytes(bytes: number | null): string | null {
  if (!bytes) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Returns a resized avatar URL appropriate for small icon usage.
 *
 * - Supabase Storage URLs: rewritten to use the render/image transform endpoint.
 *   Requires Supabase image transformations to be enabled on the project plan.
 * - Google profile URLs (lh3.googleusercontent.com): size param appended.
 * - Other URLs: returned as-is.
 */
export function avatarThumbnailUrl(url: string | null | undefined, sizePx: number): string | null {
  if (!url) return null

  // Supabase Storage: /storage/v1/object/public/ → /storage/v1/render/image/public/
  if (url.includes('.supabase.co/storage/v1/object/public/')) {
    const transformed = url.replace(
      '/storage/v1/object/public/',
      '/storage/v1/render/image/public/'
    )
    const sep = transformed.includes('?') ? '&' : '?'
    return `${transformed}${sep}width=${sizePx}&height=${sizePx}&quality=75&resize=cover`
  }

  // Google profile photos support a size param at the end of the URL
  if (url.includes('lh3.googleusercontent.com')) {
    // Strip existing =sXXX-c size suffix if present, then append desired size
    return url.replace(/=s\d+-c$/, '') + `=s${sizePx}-c`
  }

  return url
}
