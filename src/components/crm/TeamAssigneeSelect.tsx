'use client'

import { encodeAssigneeValue, parseAssigneeValue } from '@/lib/team-assignment'

type Team = { id: string; name: string }
type User = { id: string; display_name: string }

export function TeamAssigneeSelect({
  teamId,
  assignedTo,
  teams,
  users,
  onChange,
  className,
}: {
  teamId: string | null
  assignedTo: string | null
  teams: Team[]
  users: User[]
  onChange: (assignment: { teamId: string | null; assignedTo: string | null }) => void
  className?: string
}) {
  const value = assignedTo
    ? encodeAssigneeValue('user', assignedTo)
    : teamId
    ? encodeAssigneeValue('team', teamId)
    : ''

  return (
    <select
      value={value}
      onChange={(e) => {
        const parsed = parseAssigneeValue(e.target.value)
        onChange({
          teamId: parsed?.kind === 'team' ? parsed.id : null,
          assignedTo: parsed?.kind === 'user' ? parsed.id : null,
        })
      }}
      className={className ?? 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white'}
    >
      <option value="">- Unassigned -</option>
      <optgroup label="Teams">
        {teams.map((team) => (
          <option key={team.id} value={`team:${team.id}`}>{team.name}</option>
        ))}
      </optgroup>
      <optgroup label="Individuals">
        {users.map((user) => (
          <option key={user.id} value={`user:${user.id}`}>{user.display_name}</option>
        ))}
      </optgroup>
    </select>
  )
}
