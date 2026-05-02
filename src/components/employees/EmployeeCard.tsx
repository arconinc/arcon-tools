import Link from 'next/link'
import { EmployeeSummary } from '@/types'
import EmployeeAvatar from './EmployeeAvatar'
import OfficeLocationBadge from './OfficeLocationBadge'
import { DEPARTMENT_DISPLAY_NAMES } from '@/lib/task-constants'
import type { CrmTaskDepartment } from '@/types'

export default function EmployeeCard({ employee }: { employee: EmployeeSummary }) {
  return (
    <Link
      href={`/employees/${employee.id}`}
      className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-purple-300 hover:shadow-md transition-all group"
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
          {employee.department && employee.department.length > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">
              {employee.department.map((d) => DEPARTMENT_DISPLAY_NAMES[d as CrmTaskDepartment] ?? d).join(', ')}
            </p>
          )}
        </div>
      </div>
      {employee.office_location && (
        <div className="mt-3">
          <OfficeLocationBadge location={employee.office_location} />
        </div>
      )}
    </Link>
  )
}
