import { opportunityStatusBadge } from '@/lib/badges'

type OpportunityItem = {
  id: string
  name: string
  value: number | null
  status: string
  pipeline_stage: string | null
  forecast_close_date: string | null
}

export function CustomerOpportunitiesList({
  opportunities,
  customerName,
  customerId,
  onAddClick,
  onOpportunityClick,
}: {
  opportunities: OpportunityItem[]
  customerName: string
  customerId: string
  onAddClick: () => void
  onOpportunityClick: (id: string) => void
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h2 className="text-sm font-semibold text-slate-700">
          Opportunities ({opportunities.length})
        </h2>
        <button
          onClick={onAddClick}
          className="text-xs font-semibold text-purple-700 hover:text-purple-900"
        >
          + Add
        </button>
      </div>
      {opportunities.length === 0 ? (
        <div className="px-5 py-5 text-sm text-slate-400 text-center">
          No opportunities yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {opportunities.map((o) => (
            <div
              key={o.id}
              onClick={() => onOpportunityClick(o.id)}
              className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">{o.name}</div>
                <div className="text-xs text-slate-400">{o.pipeline_stage ?? 'No stage'}</div>
              </div>
              <div className="text-right">
                {o.value != null && (
                  <div className="text-sm font-semibold text-slate-700">
                    ${o.value.toLocaleString()}
                  </div>
                )}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${opportunityStatusBadge(
                    o.status
                  )}`}
                >
                  {o.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
