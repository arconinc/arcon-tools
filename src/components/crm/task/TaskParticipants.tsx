'use client'

import EmployeeAvatar from '@/components/employees/EmployeeAvatar'
import type { ParticipantRef } from '@/lib/task-participants'

// Overlapping avatar stack of everyone involved in the task — creator,
// current/past assignees, and everyone who's posted in the thread — so the
// header shows the whole cast, not just a one-directional "A → B" chip.
export function TaskParticipants({ participants, max = 6 }: { participants: ParticipantRef[]; max?: number }) {
  if (participants.length === 0) return null
  const visible = participants.slice(0, max)
  const overflow = participants.length - visible.length

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((p) => (
        <div key={p.id} title={p.display_name} className="rounded-full ring-2 ring-white">
          <EmployeeAvatar displayName={p.display_name} avatarUrl={p.avatar_url} profileImageUrl={p.profile_image_url} size="sm" />
        </div>
      ))}
      {overflow > 0 && (
        <div
          title={`+${overflow} more`}
          className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center ring-2 ring-white flex-shrink-0"
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
