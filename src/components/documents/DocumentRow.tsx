'use client'

import { useState, useEffect, useRef } from 'react'
import type { DriveDocument } from '@/types'

export function DocumentNameCell({
  doc,
  canManage,
  permBadge,
  isHighlighted,
}: {
  doc: DriveDocument
  canManage: boolean
  permBadge: string | null
  isHighlighted?: boolean
}) {
  const [fetching, setFetching] = useState(false)
  const rowRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isHighlighted) rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [isHighlighted])

  async function handleOpen() {
    setFetching(true)
    try {
      const res = await fetch(`/api/documents/open?docId=${doc.id}`)
      if (res.ok) {
        const { url } = await res.json()
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        const { error } = await res.json().catch(() => ({ error: 'Access denied' }))
        alert(error ?? 'Could not open document.')
      }
    } finally {
      setFetching(false)
    }
  }

  const isUploaded = !!doc.storage_path

  return (
    <button
      ref={rowRef}
      className="doc-link"
      onClick={handleOpen}
      disabled={fetching}
      style={{
        background: isHighlighted ? '#fef3c7' : 'none',
        border: 'none',
        padding: isHighlighted ? '0.375rem 0.5rem' : 0,
        margin: isHighlighted ? '-0.375rem -0.5rem' : 0,
        borderRadius: isHighlighted ? '6px' : 0,
        textAlign: 'left',
        transition: 'background 0.3s',
      }}
    >
      {isUploaded ? (
        <svg className="doc-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
      ) : (
        <svg className="doc-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      )}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
          <span className="doc-title">{doc.title}{fetching ? ' …' : ''}</span>
          {(doc.version ?? 1) > 1 && <span className="version-badge">v{doc.version}</span>}
          {isHighlighted && (
            <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#92400e', borderRadius: '4px', padding: '0.1rem 0.4rem', fontWeight: 600 }}>linked</span>
          )}
        </div>
        {doc.description && <div className="doc-subtitle">{doc.description}</div>}
        {canManage && permBadge !== null && <div className="perm-badge">{permBadge}</div>}
        {canManage && permBadge === null && <div className="perm-badge open">Open to all</div>}
      </div>
    </button>
  )
}

export function DocumentActionsCell({
  doc,
  sectionSlug,
  folderId,
  canManage,
  onEdit,
  onReplace,
  onDelete,
  onPermissions,
  onMove,
  onShareCopied,
}: {
  doc: DriveDocument
  sectionSlug: string
  folderId: string
  canManage: boolean
  onEdit: () => void
  onReplace: () => void
  onDelete: () => void
  onPermissions: () => void
  onMove: () => void
  onShareCopied: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  function openMenu() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setMenuOpen(o => !o)
  }

  function handleShare() {
    const shareUrl = `${window.location.origin}/documents/${sectionSlug}?folder=${folderId}&doc=${doc.id}`
    navigator.clipboard.writeText(shareUrl).then(onShareCopied)
    setMenuOpen(false)
  }

  return (
    <div ref={menuRef} className="actions-cell" style={{ textAlign: 'right' }}>
      <button ref={btnRef} className="actions-menu-btn" onClick={openMenu} title="Actions">
        •••
      </button>
      {menuOpen && (
        <div className="actions-dropdown" style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}>
          <button className="actions-dropdown-item" onClick={handleShare}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            Share link
          </button>
          {canManage && (
            <>
              <button className="actions-dropdown-item" onClick={() => { onMove(); setMenuOpen(false) }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                Move
              </button>
              <button className="actions-dropdown-item" onClick={() => { onEdit(); setMenuOpen(false) }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Edit details
              </button>
              <button className="actions-dropdown-item" onClick={() => { onReplace(); setMenuOpen(false) }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Replace file
              </button>
              <button className="actions-dropdown-item" onClick={() => { onPermissions(); setMenuOpen(false) }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Permissions
              </button>
              <div className="actions-dropdown-divider" />
              <button className="actions-dropdown-item danger" onClick={() => { onDelete(); setMenuOpen(false) }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
