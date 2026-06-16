'use client'

import type { SpecIdea } from '@/types'

export function IdeaCard({
  idea,
  isSelected,
  onClick,
  imageHeight = 120,
  showCategory = false,
  showPlaceholder = false,
}: {
  idea: SpecIdea
  isSelected: boolean
  onClick: () => void
  imageHeight?: number
  showCategory?: boolean
  showPlaceholder?: boolean
}) {
  return (
    <div
      className={`idea-card ${isSelected ? 'idea-card-selected' : ''}`}
      onClick={onClick}
    >
      <div style={{ position: 'relative', height: imageHeight, background: '#f8fafc', overflow: 'hidden' }}>
        {idea.image_url ? (
          <img src={idea.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : showPlaceholder ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#cbd5e1" strokeWidth={1}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path strokeLinecap="round" d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        ) : null}
        {isSelected && (
          <div className="check-overlay">
            <svg width="12" height="12" fill="white" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
        )}
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', lineHeight: 1.3 }}>{idea.item_name}</div>
        <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>{idea.vendor}</div>
        {idea.price_range && <div style={{ fontSize: 11, color: '#374151', marginTop: 2, fontWeight: 600 }}>{idea.price_range}</div>}
        {showCategory && idea.category && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{idea.category}</div>}
      </div>
    </div>
  )
}
