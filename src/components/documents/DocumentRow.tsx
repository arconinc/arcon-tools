'use client'

import { useState, useEffect, useRef } from 'react'
import type { DriveDocument } from '@/types'

function getFileExt(doc: DriveDocument): string {
  const src = doc.storage_path ?? doc.title
  return src.split('.').pop()?.toLowerCase() ?? ''
}

function isImageDoc(doc: DriveDocument) {
  return !!doc.storage_path && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(getFileExt(doc))
}

function isPdfDoc(doc: DriveDocument) {
  return !!doc.storage_path && getFileExt(doc) === 'pdf'
}

function isPreviewable(doc: DriveDocument) {
  return isImageDoc(doc) || isPdfDoc(doc)
}

async function fetchSignedUrl(docId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/documents/open?docId=${docId}`)
    if (!res.ok) return null
    const { url } = await res.json()
    return url ?? null
  } catch {
    return null
  }
}

async function renderPdfThumbnail(url: string, canvas: HTMLCanvasElement, size = 48) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString()
  const pdf = await pdfjsLib.getDocument({ url, verbosity: 0 }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1 })
  const scale = size / Math.min(viewport.width, viewport.height)
  const scaled = page.getViewport({ scale })
  canvas.width = scaled.width
  canvas.height = scaled.height
  await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport: scaled }).promise
}

function PdfThumbnail({ docId, size = 48 }: { docId: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchSignedUrl(docId).then(url => {
      if (!url || !canvasRef.current) { setError(true); return }
      renderPdfThumbnail(url, canvasRef.current, size).catch(() => setError(true))
    })
  }, [docId, size])

  if (error) return (
    <div style={{ width: size, height: size, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size * 0.5} height={size * 0.5} fill="none" viewBox="0 0 24 24" stroke="#ef4444"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    </div>
  )

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb', flexShrink: 0, display: 'block' }}
    />
  )
}

export function DocPreviewModal({ docId, title, type, onClose }: {
  docId: string
  title: string
  type: 'image' | 'pdf'
  onClose: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSignedUrl(docId).then(u => { setUrl(u); setLoading(false) })
  }, [docId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="preview-modal"
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          width: type === 'pdf' ? 'min(900px, 95vw)' : 'min(800px, 95vw)',
          height: type === 'pdf' ? '90vh' : 'auto',
          maxHeight: '90vh',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: '0.925rem', color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#7c3aed', textDecoration: 'none', padding: '0.35rem 0.75rem', border: '1px solid #ede9fe', borderRadius: 6 }}>
                Open ↗
              </a>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.25rem', lineHeight: 1, padding: '0.25rem' }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: type === 'image' ? '#f9fafb' : '#fff', minHeight: 0 }}>
          {loading && <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Loading…</span>}
          {!loading && !url && <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>Could not load preview.</span>}
          {!loading && url && type === 'image' && (
            <img src={url} alt={title} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, padding: '1rem' }} />
          )}
          {!loading && url && type === 'pdf' && (
            <iframe src={url} title={title} style={{ width: '100%', height: '100%', border: 'none' }} />
          )}
        </div>
      </div>
    </div>
  )
}

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
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const rowRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isHighlighted) rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [isHighlighted])

  useEffect(() => {
    if (!isImageDoc(doc)) return
    fetchSignedUrl(doc.id).then(u => { if (u) setThumbUrl(u) })
  }, [doc.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
        alignItems: (thumbUrl || isPdfDoc(doc)) ? 'center' : 'flex-start',
      }}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt=""
          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid #e5e7eb' }}
        />
      ) : isPdfDoc(doc) ? (
        <PdfThumbnail docId={doc.id} size={48} />
      ) : isUploaded ? (
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
  const [previewOpen, setPreviewOpen] = useState(false)
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
          {isPreviewable(doc) && (
            <button className="actions-dropdown-item" onClick={() => { setPreviewOpen(true); setMenuOpen(false) }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              Preview
            </button>
          )}
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
      {previewOpen && (
        <DocPreviewModal
          docId={doc.id}
          title={doc.title}
          type={isImageDoc(doc) ? 'image' : 'pdf'}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  )
}

const ICON_SIZE = 72

function DocIcon({ doc }: { doc: DriveDocument }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!isImageDoc(doc)) return
    fetchSignedUrl(doc.id).then(u => { if (u) setThumbUrl(u) })
  }, [doc.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (thumbUrl) {
    return <img src={thumbUrl} alt="" style={{ width: ICON_SIZE, height: ICON_SIZE, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb', display: 'block' }} />
  }
  if (isPdfDoc(doc)) {
    return <PdfThumbnail docId={doc.id} size={ICON_SIZE} />
  }
  if (doc.storage_path) {
    return (
      <div style={{ width: ICON_SIZE, height: ICON_SIZE, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={ICON_SIZE * 0.55} height={ICON_SIZE * 0.55} fill="none" viewBox="0 0 24 24" stroke="#16a34a"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
      </div>
    )
  }
  return (
    <div style={{ width: ICON_SIZE, height: ICON_SIZE, borderRadius: 8, border: '1px solid #e5e7eb', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={ICON_SIZE * 0.55} height={ICON_SIZE * 0.55} fill="none" viewBox="0 0 24 24" stroke="#3b82f6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    </div>
  )
}

export function DocIconCard({
  doc, canManage, sectionSlug, folderId, isHighlighted,
  onEdit, onReplace, onDelete, onPermissions, onMove, onShareCopied,
}: {
  doc: DriveDocument; canManage: boolean; sectionSlug: string; folderId: string
  isHighlighted?: boolean
  onEdit: () => void; onReplace: () => void; onDelete: () => void
  onPermissions: () => void; onMove: () => void; onShareCopied: () => void
}) {
  const [fetching, setFetching] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [previewOpen, setPreviewOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [menuOpen])

  async function handleOpen(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.icon-menu-area')) return
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
    } finally { setFetching(false) }
  }

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation()
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 4, left: r.left })
    }
    setMenuOpen(o => !o)
  }

  function handleShare() {
    const shareUrl = `${window.location.origin}/documents/${sectionSlug}?folder=${folderId}&doc=${doc.id}`
    navigator.clipboard.writeText(shareUrl).then(onShareCopied)
    setMenuOpen(false)
  }

  return (
    <div
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '0.4rem', padding: '0.625rem 0.5rem', borderRadius: 10,
        cursor: fetching ? 'wait' : 'pointer',
        background: isHighlighted ? '#fef3c7' : hovered ? '#f5f3ff' : 'transparent',
        border: isHighlighted ? '1.5px solid #fcd34d' : '1.5px solid transparent',
        transition: 'background 0.12s, border-color 0.12s',
        width: 110, minWidth: 0,
      }}
      onClick={handleOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <DocIcon doc={doc} />
      <span style={{
        fontSize: '0.75rem', color: '#111', textAlign: 'center', lineHeight: 1.3,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', wordBreak: 'break-word', width: '100%',
        opacity: fetching ? 0.5 : 1,
      }}>{doc.title}</span>

      <div className="icon-menu-area" ref={menuRef} style={{ position: 'absolute', top: 4, right: 4, opacity: hovered || menuOpen ? 1 : 0, transition: 'opacity 0.1s' }}>
        <button ref={btnRef} onClick={openMenu} title="Actions" style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#6b7280', padding: 0 }}>
          •••
        </button>
        {menuOpen && (
          <div className="actions-dropdown" style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999, minWidth: 160 }}>
            {isPreviewable(doc) && (
              <button className="actions-dropdown-item" onClick={e => { e.stopPropagation(); setPreviewOpen(true); setMenuOpen(false) }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                Preview
              </button>
            )}
            <button className="actions-dropdown-item" onClick={e => { e.stopPropagation(); handleShare() }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              Share link
            </button>
            {canManage && (
              <>
                <button className="actions-dropdown-item" onClick={e => { e.stopPropagation(); onMove(); setMenuOpen(false) }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  Move
                </button>
                <button className="actions-dropdown-item" onClick={e => { e.stopPropagation(); onEdit(); setMenuOpen(false) }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Edit details
                </button>
                <button className="actions-dropdown-item" onClick={e => { e.stopPropagation(); onReplace(); setMenuOpen(false) }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Replace file
                </button>
                <button className="actions-dropdown-item" onClick={e => { e.stopPropagation(); onPermissions(); setMenuOpen(false) }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Permissions
                </button>
                <div className="actions-dropdown-divider" />
                <button className="actions-dropdown-item danger" onClick={e => { e.stopPropagation(); onDelete(); setMenuOpen(false) }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {previewOpen && (
        <DocPreviewModal
          docId={doc.id}
          title={doc.title}
          type={isImageDoc(doc) ? 'image' : 'pdf'}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  )
}
