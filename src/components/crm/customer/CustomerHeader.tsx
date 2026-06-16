import { customerStatusBadge } from '@/lib/badges'
import { CrmDetailActions } from '@/components/crm/CrmDetailActions'

type CustomerHeaderProps = {
  name: string
  logo_url: string | null
  client_status: string | null
  assigned_user: { id: string; display_name: string; email: string } | null
  phone: string | null
  website: string | null
  id: string
  onCreateOpportunity: () => void
  onCreateTask: () => void
}

export function CustomerHeader({
  name,
  logo_url,
  client_status,
  assigned_user,
  phone,
  website,
  id,
  onCreateOpportunity,
  onCreateTask,
}: CustomerHeaderProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
      <div className="flex items-center gap-4">
        {logo_url && (
          <img
            src={logo_url}
            alt={`${name} logo`}
            className="h-10 w-auto max-w-[180px] object-contain flex-shrink-0"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 truncate">{name}</h1>
            {client_status && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${customerStatusBadge(
                  client_status
                )}`}
              >
                {client_status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            {assigned_user && (
              <span className="text-xs text-slate-500">
                Owner:{' '}
                <span className="text-slate-700 font-medium">{assigned_user.display_name}</span>
              </span>
            )}
            {phone && <span className="text-xs text-slate-500">{phone}</span>}
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-700 hover:underline"
              >
                {website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={onCreateOpportunity}
            className="px-3 py-1.5 border border-purple-300 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-50 transition-colors"
          >
            + Opportunity
          </button>
          <CrmDetailActions onCreateTask={onCreateTask} />
        </div>
      </div>
    </div>
  )
}
