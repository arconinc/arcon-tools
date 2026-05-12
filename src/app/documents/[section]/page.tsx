'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import type { DocSectionWithFolders, DocFolderWithDocuments, DriveDocument } from '@/types'

const SECTION_MAP: Record<string, string> = {
  'hr': 'HR',
  'marketing': 'Marketing',
  'accounting': 'Accounting',
  'ecommerce': 'E-Commerce',
  'technology': 'Technology',
  'sales': 'Sales',
  'warehouse': 'Warehouse',
}

export default function SectionDocumentsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const sectionSlug = params.section as string
  const sectionName = SECTION_MAP[sectionSlug]
  const folderParam = searchParams.get('folder')
  const docParam = searchParams.get('doc')

  const [sections, setSections] = useState<DocSectionWithFolders[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [highlightedDocId, setHighlightedDocId] = useState<string | null>(docParam)
  const [notFound, setNotFound] = useState(false)
  const [toastDocId, setToastDocId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(data => {
        const secs: DocSectionWithFolders[] = data.sections ?? []
        const targetSection = secs.find(s => s.name === sectionName)

        if (!targetSection) {
          setNotFound(true)
          return
        }

        setSections([targetSection])

        // If folder parameter is provided, use it; otherwise use first folder
        if (folderParam) {
          const folder = targetSection.folders.find(f => f.id === folderParam)
          if (folder) {
            setSelectedFolderId(folderParam)
          } else {
            // Folder not found, default to first
            setSelectedFolderId(targetSection.folders[0]?.id ?? null)
          }
        } else if (targetSection.folders.length > 0) {
          setSelectedFolderId(targetSection.folders[0].id)
        }
      })
      .catch(err => {
        console.error('Failed to fetch documents:', err)
        setNotFound(true)
      })
      .finally(() => setLoading(false))
  }, [sectionName, folderParam])

  if (loading) {
    return (
      <>
        <style>{`
          .section-docs-page { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
          .loading-dots { display: flex; gap: 0.4rem; justify-content: center; padding: 4rem; }
          .loading-dots span { width: 8px; height: 8px; border-radius: 50%; background: #7c3aed; animation: bounce 0.8s infinite; }
          .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
          .loading-dots span:nth-child(3) { animation-delay: 0.3s; }
          @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-8px); } }
        `}</style>
        <div className="section-docs-page">
          <div className="loading-dots">
            <span /><span /><span />
          </div>
        </div>
      </>
    )
  }

  if (notFound || sections.length === 0) {
    return (
      <>
        <style>{`
          .section-docs-page { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
          .error-state { text-align: center; padding: 4rem 2rem; color: #9ca3af; }
          .error-state h2 { font-size: 1.25rem; font-weight: 600; color: #111; margin: 0 0 0.5rem; }
        `}</style>
        <div className="section-docs-page">
          <div className="error-state">
            <h2>Section not found</h2>
            <p>The section "{sectionSlug}" could not be found or you don't have access to it.</p>
          </div>
        </div>
      </>
    )
  }

  const section = sections[0]
  const selectedFolder = section.folders.find(f => f.id === selectedFolderId)

  return (
    <>
      <style>{`
        .section-docs-page { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }

        .docs-header { margin-bottom: 2rem; }
        .docs-header h1 { font-size: 1.75rem; font-weight: 700; color: #111; margin: 0 0 0.25rem; }
        .docs-header p { color: #666; margin: 0; font-size: 0.9rem; }

        .tabs-container { margin-bottom: 2rem; }
        .tabs { display: flex; gap: 0.5rem; border-bottom: 2px solid #e5e7eb; }
        .tab { padding: 0.75rem 1rem; cursor: pointer; font-size: 0.95rem; font-weight: 500; color: #666; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.2s; white-space: nowrap; }
        .tab:hover { color: #7c3aed; }
        .tab.active { color: #7c3aed; border-bottom-color: #7c3aed; }

        .table-container { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .table { width: 100%; border-collapse: collapse; }
        .table th { padding: 1rem 1.25rem; text-align: left; font-weight: 600; font-size: 0.875rem; color: #6b7280; background: #fafafa; border-bottom: 1px solid #e5e7eb; }
        .table td { padding: 1rem 1.25rem; border-bottom: 1px solid #f3f4f6; }
        .table tr:last-child td { border-bottom: none; }
        .table tbody tr:hover { background: #fafafa; }
        .table tbody tr.highlighted { background: #fef3c7; }
        .table tbody tr.highlighted:hover { background: #fcd34d; }

        .doc-name { font-weight: 500; color: #111; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
        .doc-icon { width: 16px; height: 16px; color: #6b7280; flex-shrink: 0; }
        .doc-name:hover { color: #7c3aed; }
        .doc-name:hover .doc-icon { color: #7c3aed; }

        .doc-description { color: #9ca3af; font-size: 0.875rem; }

        .actions { display: flex; gap: 0.5rem; }
        .action-btn { padding: 0.5rem 1rem; font-size: 0.85rem; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .share-btn { background: #fff; color: #7c3aed; }
        .share-btn:hover { background: #f3f0ff; border-color: #7c3aed; }
        .open-btn { background: #7c3aed; color: #fff; border-color: #7c3aed; }
        .open-btn:hover { background: #6d28d9; border-color: #6d28d9; }
        .action-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .empty-state { text-align: center; padding: 4rem 2rem; color: #9ca3af; }
        .empty-state svg { width: 48px; height: 48px; margin: 0 auto 1rem; display: block; color: #e5e7eb; }

        .toast-notification { position: fixed; bottom: 2rem; right: 2rem; background: #10b981; color: #fff; padding: 1rem 1.5rem; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: slideIn 0.3s ease-out; z-index: 1000; }
        @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>

      <div className="section-docs-page">
        <div className="docs-header">
          <h1>{section.name} Documents</h1>
          <p>{section.folders.length} folder{section.folders.length !== 1 ? 's' : ''}</p>
        </div>

        {section.folders.length === 0 ? (
          <div className="empty-state">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
            <p>No documents in this section.</p>
          </div>
        ) : (
          <>
            <div className="tabs-container">
              <div className="tabs">
                {section.folders.map(folder => (
                  <button
                    key={folder.id}
                    className={`tab${selectedFolderId === folder.id ? ' active' : ''}`}
                    onClick={() => setSelectedFolderId(folder.id)}
                  >
                    {folder.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedFolder && selectedFolder.documents.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Name</th>
                      <th style={{ width: '40%' }}>Description</th>
                      <th style={{ width: '20%' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedFolder.documents.map(doc => (
                      <DocumentRow
                        key={doc.id}
                        doc={doc}
                        sectionSlug={sectionSlug}
                        folderId={selectedFolder.id}
                        isHighlighted={highlightedDocId === doc.id}
                        onShareCopied={() => {
                          setToastDocId(doc.id)
                          setTimeout(() => setToastDocId(null), 2000)
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No documents in this folder.</p>
              </div>
            )}
          </>
        )}

        {toastDocId && (
          <div className="toast-notification">
            Link copied to clipboard
          </div>
        )}
      </div>
    </>
  )
}

function DocumentRow({
  doc,
  sectionSlug,
  folderId,
  isHighlighted = false,
  onShareCopied,
}: {
  doc: DriveDocument
  sectionSlug: string
  folderId: string
  isHighlighted?: boolean
  onShareCopied: () => void
}) {
  const [fetching, setFetching] = useState(false)

  const isUploaded = !!doc.storage_path

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

  function handleShare() {
    const shareUrl = `${window.location.origin}/documents/${sectionSlug}?folder=${folderId}&doc=${doc.id}`
    navigator.clipboard.writeText(shareUrl).then(() => {
      onShareCopied()
    })
  }

  return (
    <tr className={isHighlighted ? 'highlighted' : ''}>
      <td>
        <div className="doc-name">
          {isUploaded ? (
            <svg className="doc-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
          ) : (
            <svg className="doc-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          )}
          {doc.title}
        </div>
      </td>
      <td className="doc-description">{doc.description || '—'}</td>
      <td>
        <div className="actions">
          <button className="action-btn share-btn" onClick={handleShare} title="Copy share link">
            Share
          </button>
          <button
            className="action-btn open-btn"
            onClick={handleOpen}
            disabled={fetching}
            title="Open document"
          >
            {fetching ? 'Opening…' : 'Open'}
          </button>
        </div>
      </td>
    </tr>
  )
}
