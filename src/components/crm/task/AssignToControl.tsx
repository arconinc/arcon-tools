'use client'

import { TeamAssigneeSelect } from '@/components/crm/TeamAssigneeSelect'
import { ReassignGlyph } from '@/components/crm/task/TaskIcons'

type Team = { id: string; name: string }
type User = { id: string; display_name: string }

// The task's single most-missed control — people didn't realize the small
// text link could be clicked to assign the task. This renders as a real
// button (border, fill, padding) so it reads as an actionable control at a
// glance, not a caption.
export function AssignToControl({
  teamId,
  assignedTo,
  displayLabel,
  teams,
  users,
  editing,
  onStartEdit,
  onChange,
}: {
  teamId: string | null
  assignedTo: string | null
  displayLabel: string
  teams: Team[]
  users: User[]
  editing: boolean
  onStartEdit: () => void
  onChange: (assignment: { teamId: string | null; assignedTo: string | null }) => void
}) {
  if (editing) {
    return (
      <TeamAssigneeSelect
        teamId={teamId}
        assignedTo={assignedTo}
        teams={teams}
        users={users}
        onChange={onChange}
        className="text-sm font-semibold border-2 border-purple-400 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white shadow-sm"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={onStartEdit}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-purple-300 bg-purple-50 hover:bg-purple-100 hover:border-purple-400 transition-colors shadow-sm"
    >
      <ReassignGlyph className="h-4 w-4 text-purple-500" />
      <span className="text-[10px] font-bold uppercase tracking-wide text-purple-500">Assign to</span>
      <span className="text-sm font-bold text-slate-900">{displayLabel}</span>
    </button>
  )
}
