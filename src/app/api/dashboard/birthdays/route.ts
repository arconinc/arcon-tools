import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BirthdayEvent } from '@/types'

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

// Returns how many days until the next occurrence of the given month/day.
// Returns 0 if it's today, negative values are treated as next year.
function daysUntilNextOccurrence(month: number, day: number, today: Date): number {
  const thisYear = today.getFullYear()
  const thisOccurrence = new Date(thisYear, month - 1, day)
  const diff = Math.floor((thisOccurrence.getTime() - today.getTime()) / 86400000)
  if (diff >= 0) return diff
  // Already passed this year — use next year
  const nextOccurrence = new Date(thisYear + 1, month - 1, day)
  return Math.floor((nextOccurrence.getTime() - today.getTime()) / 86400000)
}

function formatDateLabel(month: number, day: number, daysUntil: number): string {
  if (daysUntil === 0) return 'Today'
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[month - 1]} ${day}`
}

const AVATAR_COLORS = [
  '#6b1e98', '#9333ea', '#7c3aed', '#374151', '#1e4d8c',
  '#15803d', '#c2410c', '#0f3460', '#0c4a6e', '#4a1575',
]

function avatarColor(name: string): string {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: users, error } = await adminClient
    .from('users')
    .select('id, display_name, birth_date, start_date')
    .or('birth_date.not.is.null,start_date.not.is.null')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Use start of today (midnight) to avoid partial-day drift
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const events: BirthdayEvent[] = []

  for (const u of users ?? []) {
    const name = u.display_name || 'Unknown'
    const initials = getInitials(name)

    if (u.birth_date) {
      const [year, month, day] = u.birth_date.split('-').map(Number)
      if (month && day) {
        const daysUntil = daysUntilNextOccurrence(month, day, today)
        if (daysUntil <= 14) {
          // Suppress year — just use month+day for the label
          void year
          events.push({
            id: `${u.id}-bday`,
            name,
            initials,
            type: 'birthday',
            days_until: daysUntil,
            date_label: formatDateLabel(month, day, daysUntil),
          })
        }
      }
    }

    if (u.start_date) {
      const [startYear, month, day] = u.start_date.split('-').map(Number)
      if (month && day && startYear) {
        const daysUntil = daysUntilNextOccurrence(month, day, today)
        if (daysUntil <= 14) {
          // If the anniversary date this year hasn't passed yet, years = currentYear - startYear
          // If it already passed and we're using next year's occurrence, years = (currentYear + 1) - startYear
          const anniversaryYearOffset = daysUntil < 365 ? 0 : 1
          const years = today.getFullYear() + anniversaryYearOffset - startYear
          if (years > 0) {
            events.push({
              id: `${u.id}-ann`,
              name,
              initials,
              type: 'anniversary',
              days_until: daysUntil,
              date_label: formatDateLabel(month, day, daysUntil),
              years,
            })
          }
        }
      }
    }
  }

  events.sort((a, b) => a.days_until - b.days_until)

  // Add avatar color for the UI (not in the type, pass as extra field)
  const eventsWithColor = events.map((e) => ({ ...e, color: avatarColor(e.name) }))

  const birthdays_this_week = events.filter((e) => e.type === 'birthday' && e.days_until <= 6).length

  return NextResponse.json({ events: eventsWithColor, birthdays_this_week })
}
