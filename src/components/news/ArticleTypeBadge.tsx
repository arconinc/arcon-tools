'use client'

import { ARTICLE_TYPE_BADGE } from '@/lib/news-utils'
import type { ArticleType } from '@/types'

interface Props {
  type: ArticleType
  size?: 'sm' | 'md'
}

export function ArticleTypeBadge({ type, size = 'md' }: Props) {
  const config = ARTICLE_TYPE_BADGE[type] ?? ARTICLE_TYPE_BADGE.GENERAL
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs font-semibold px-2.5 py-1'
  return (
    <span className={`inline-flex items-center font-semibold rounded-full ${sizeClasses} ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}
