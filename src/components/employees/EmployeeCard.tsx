import Link from 'next/link'
import { EmployeeSummary } from '@/types'
import EmployeeAvatar from './EmployeeAvatar'
import OfficeLocationBadge from './OfficeLocationBadge'

export default function EmployeeCard({ employee }: { employee: EmployeeSummary }) {
  return (
    <Link
      href={`/employees/${employee.id}`}
      className="block w-full bg-white rounded-xl border border-slate-200 p-5 hover:border-purple-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        <EmployeeAvatar
          displayName={employee.display_name}
          profileImageUrl={employee.profile_image_url}
          avatarUrl={employee.avatar_url}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 truncate group-hover:text-purple-700 transition-colors">
            {employee.display_name}
          </p>
          {employee.job_title && (
            <p className="text-sm text-slate-500 truncate mt-0.5">{employee.job_title}</p>
          )}
          {employee.teams.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {employee.teams.map((t) => (
                <span
                  key={t.id}
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ background: `${t.color}18`, color: t.color }}
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-xs text-slate-500 truncate">
          <span className="text-slate-400">✉</span>{' '}
          <span className="hover:text-purple-600">{employee.email}</span>
        </p>
        {employee.phone && (
          <p className="text-xs text-slate-500 truncate">
            <span className="text-slate-400">📞</span>{' '}
            {employee.phone}
          </p>
        )}
      </div>

      {employee.bio_html && (
        <p
          className="mt-3 text-xs text-slate-400 line-clamp-2 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: employee.bio_html }}
        />
      )}

      {employee.office_location && (
        <div className="mt-3">
          <OfficeLocationBadge location={employee.office_location} />
        </div>
      )}
    </Link>
  )
}
