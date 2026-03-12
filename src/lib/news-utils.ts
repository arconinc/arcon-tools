import type { ArticleType } from '@/types'

// ─── Text Utilities ───────────────────────────────────────────────────────────

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function generateExcerpt(html: string, maxLength = 160): string {
  const text = stripHtml(html)
  if (text.length <= maxLength) return text
  const trimmed = text.substring(0, maxLength)
  const lastSpace = trimmed.lastIndexOf(' ')
  return (lastSpace > 0 ? trimmed.substring(0, lastSpace) : trimmed) + '...'
}

export function computeReadingTime(html: string): number {
  const text = stripHtml(html)
  const wordCount = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(wordCount / 200))
}

// ─── Badge Config ─────────────────────────────────────────────────────────────

export interface ArticleTypeBadgeConfig {
  label: string
  bg: string
  text: string
}

export const ARTICLE_TYPE_BADGE: Record<ArticleType, ArticleTypeBadgeConfig> = {
  COMPANY:    { label: 'Company',    bg: 'bg-purple-100', text: 'text-purple-700' },
  HR:         { label: 'HR',         bg: 'bg-pink-100',   text: 'text-pink-700'   },
  SALES:      { label: 'Sales',      bg: 'bg-green-100',  text: 'text-green-700'  },
  IT:         { label: 'IT',         bg: 'bg-blue-100',   text: 'text-blue-700'   },
  FINANCE:    { label: 'Finance',    bg: 'bg-amber-100',  text: 'text-amber-700'  },
  OPERATIONS: { label: 'Operations', bg: 'bg-orange-100', text: 'text-orange-700' },
  GENERAL:    { label: 'General',    bg: 'bg-slate-100',  text: 'text-slate-600'  },
}

export const ARTICLE_TYPES: ArticleType[] = [
  'COMPANY', 'HR', 'SALES', 'IT', 'FINANCE', 'OPERATIONS', 'GENERAL',
]

// ─── Date Formatting ──────────────────────────────────────────────────────────

export function formatPublishDate(dateStr: string | null): string {
  if (!dateStr) return 'Not set'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
