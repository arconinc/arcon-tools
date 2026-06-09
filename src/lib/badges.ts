// Status badge color maps — single source of truth per domain

const FALLBACK = 'bg-slate-100 text-slate-600'

export function customerStatusBadge(status: string | null | undefined): string {
  switch (status?.toLowerCase()) {
    case 'active': return 'bg-green-100 text-green-800'
    case 'prospective': return 'bg-slate-100 text-slate-700'
    case 'former': return 'bg-red-100 text-red-700'
    default: return FALLBACK
  }
}

export function opportunityStatusBadge(status: string | null | undefined): string {
  switch (status?.toLowerCase()) {
    case 'open': return 'bg-blue-100 text-blue-800'
    case 'won': return 'bg-green-100 text-green-800'
    case 'lost': return 'bg-red-100 text-red-700'
    case 'stalled': return 'bg-slate-100 text-slate-600'
    default: return FALLBACK
  }
}

export function taskStatusBadge(status: string | null | undefined): string {
  switch (status?.toLowerCase()) {
    case 'not_started': return 'bg-slate-100 text-slate-600'
    case 'in_progress': return 'bg-blue-100 text-blue-700'
    case 'completed': return 'bg-green-100 text-green-700'
    case 'waiting_on_approval': return 'bg-yellow-100 text-yellow-700'
    case 'waiting_on_client_approval': return 'bg-orange-100 text-orange-700'
    case 'need_changes': return 'bg-red-100 text-red-600'
    default: return FALLBACK
  }
}

export function orderStatusBadge(status: string | null | undefined): string {
  switch (status?.toLowerCase()) {
    case 'new': return 'bg-blue-100 text-blue-700'
    case 'approved': return 'bg-emerald-100 text-emerald-700'
    case 'declined': return 'bg-red-100 text-red-700'
    case 'shipped': return 'bg-purple-100 text-purple-700'
    default: return FALLBACK
  }
}
