// Shared helpers used across store detail tabs

export function formatDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'new': return 'bg-blue-100 text-blue-700'
    case 'approved': return 'bg-emerald-100 text-emerald-700'
    case 'declined': return 'bg-red-100 text-red-700'
    case 'shipped': return 'bg-purple-100 text-purple-700'
    default: return 'bg-slate-100 text-slate-600'
  }
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}
