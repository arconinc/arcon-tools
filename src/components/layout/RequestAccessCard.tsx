'use client'

import Link from 'next/link'
import { requiredRoleFor } from '@/lib/access'

interface RequestAccessCardProps {
  resource: string   // e.g. 'section:dashboard:financials'
  label?: string     // optional friendly name shown in the card
}

// Subtle card shown in place of restricted content, inviting the user to request access.
export function RequestAccessCard({ resource, label }: RequestAccessCardProps) {
  const role = requiredRoleFor(resource) ?? ''
  const params = new URLSearchParams({ resource, role })
  if (label) params.set('label', label)

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: '#fafafa',
      color: '#6b7280',
      fontSize: 13,
    }}>
      <LockIcon />
      <span style={{ flex: 1 }}>
        {label ? `${label} requires` : 'This section requires'} additional access.
      </span>
      <Link
        href={`/access-requests/new?${params.toString()}`}
        style={{
          fontSize: 12,
          color: '#7c3aed',
          textDecoration: 'none',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        Request Access →
      </Link>
    </div>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
