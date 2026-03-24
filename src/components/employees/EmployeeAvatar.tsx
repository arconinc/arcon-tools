import Image from 'next/image'

interface EmployeeAvatarProps {
  displayName: string
  profileImageUrl?: string | null
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: { px: 32, cls: 'w-8 h-8 text-xs' },
  md: { px: 48, cls: 'w-12 h-12 text-sm' },
  lg: { px: 80, cls: 'w-20 h-20 text-xl' },
  xl: { px: 128, cls: 'w-32 h-32 text-3xl' },
}

function initials(name: string | undefined | null) {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export default function EmployeeAvatar({
  displayName,
  profileImageUrl,
  avatarUrl,
  size = 'md',
  className = '',
}: EmployeeAvatarProps) {
  const { px, cls } = sizeMap[size]
  const src = profileImageUrl || avatarUrl

  if (src) {
    return (
      <Image
        src={src}
        alt={displayName}
        width={px}
        height={px}
        className={`${cls} rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <div
      className={`${cls} rounded-full bg-purple-600 text-white font-semibold flex items-center justify-center flex-shrink-0 ${className}`}
    >
      {initials(displayName)}
    </div>
  )
}
