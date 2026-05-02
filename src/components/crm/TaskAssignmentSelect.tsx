'use client'

import {
  DEPARTMENTS,
  DEPARTMENT_CATEGORIES,
  encodeTaskAssignmentValue,
  getTaskCategoryLabel,
  parseTaskAssignmentValue,
} from '@/lib/task-constants'
import type { CrmTaskDepartment } from '@/types'

export function TaskAssignmentSelect({
  department,
  category,
  onChange,
}: {
  department: string | null
  category: string | null
  onChange: (assignment: { department: CrmTaskDepartment | null; category: string | null }) => void
}) {
  return (
    <select
      value={encodeTaskAssignmentValue(department, category)}
      onChange={(e) => onChange(parseTaskAssignmentValue(e.target.value))}
      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
    >
      <option value="">- None -</option>
      {DEPARTMENTS.map((departmentOption) => (
        <optgroup key={departmentOption} label={departmentOption}>
          <option value={`department:${departmentOption}`}>{departmentOption}</option>
          {DEPARTMENT_CATEGORIES[departmentOption].map((categoryOption) => (
            <option key={categoryOption} value={`category:${categoryOption}`}>
              {getTaskCategoryLabel(categoryOption)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
