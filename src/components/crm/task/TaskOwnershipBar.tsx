import EmployeeAvatar from '@/components/employees/EmployeeAvatar'

interface OwnershipUser {
  display_name: string
  avatar_url?: string | null
  profile_image_url?: string | null
}

interface TaskOwnershipBarProps {
  requestor: OwnershipUser | null
  currentOwner: OwnershipUser | null
  currentOwnerTeamName?: string | null
  lastWorker?: OwnershipUser | null
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

function Slot({
  label,
  user,
  teamName,
  size,
}: {
  label: string
  user?: OwnershipUser | null
  teamName?: string | null
  size: 'xs' | 'sm' | 'md'
}) {
  if (!user && !teamName) return null
  return (
    <div className="flex items-center gap-2 min-w-0">
      {user ? (
        <EmployeeAvatar
          displayName={user.display_name}
          profileImageUrl={user.profile_image_url}
          avatarUrl={user.avatar_url}
          size={size}
        />
      ) : (
        <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[9px] font-semibold flex items-center justify-center flex-shrink-0">
          {teamName?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-gray-400 leading-none mb-0.5">{label}</div>
        <div className="text-sm font-medium text-gray-900 truncate">{user?.display_name ?? teamName}</div>
      </div>
    </div>
  )
}

// Shows who requested a task, who owns it now, and (when relevant) who last
// worked it — the three roles the guided task workflow revolves around.
export default function TaskOwnershipBar({
  requestor,
  currentOwner,
  currentOwnerTeamName,
  lastWorker,
  size = 'sm',
  className = '',
}: TaskOwnershipBarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 ${className}`}>
      <Slot label="Requested by" user={requestor} size={size} />
      <Slot label="Currently assigned to" user={currentOwner} teamName={currentOwnerTeamName} size={size} />
      {lastWorker && <Slot label="Last worked by" user={lastWorker} size={size} />}
    </div>
  )
}
