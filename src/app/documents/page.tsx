'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { DocSectionWithFolders, DriveDocument } from '@/types'

export default function DocumentsPage() {
  const [sections, setSections] = useState<DocSectionWithFolders[]>([])
  const [loading, setLoading] = useState(true)
  // Track selected folder per section: { [sectionId]: folderId }
  const [selectedFolders, setSelectedFolders] = useState<Record<string, string>>({})
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(data => {
        const secs: DocSectionWithFolders[] = data.sections ?? []
        setSections(secs)
        // Default to first folder in each section
        const defaults: Record<string, string> = {}
        for (const s of secs) {
          if (s.folders.length > 0) defaults[s.id] = s.folders[0].id
        }
        setSelectedFolders(defaults)
      })
      .finally(() => setLoading(false))
  }, [])

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  return (
    <>
      <style>{`
        .docs-page { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
        .docs-header { margin-bottom: 2rem; }
        .docs-header h1 { font-size: 1.75rem; font-weight: 700; color: #111; margin: 0 0 0.25rem; }
        .docs-header p { color: #666; margin: 0; font-size: 0.9rem; }

        .section-block { margin-bottom: 2.5rem; }
        .section-title { font-size: 1.2rem; font-weight: 700; color: #111; margin: 0 0 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #f3f4f6; display: flex; align-items: center; gap: 0.5rem; }
        .section-title-link { display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: inherit; cursor: pointer; transition: color 0.15s; }
        .section-title-link:hover { color: #7c3aed; }
        .section-icon { width: 28px; height: 28px; border-radius: 7px; background: linear-gradient(135deg, #7c3aed, #6d28d9); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .section-icon svg { width: 14px; height: 14px; color: #fff; }

        .tabs-row { display: flex; align-items: center; gap: 0.25rem; border-bottom: 2px solid #e5e7eb; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .tab { padding: 0.625rem 0.875rem; cursor: pointer; font-size: 0.9rem; font-weight: 500; color: #666; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.15s; white-space: nowrap; background: none; border-top: none; border-left: none; border-right: none; }
        .tab:hover { color: #7c3aed; }
        .tab.active { color: #7c3aed; border-bottom-color: #7c3aed; }

        .table-container { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .table { width: 100%; border-collapse: collapse; }
        .table th { padding: 0.75rem 1.125rem; text-align: left; font-weight: 600; font-size: 0.775rem; color: #6b7280; background: #fafafa; border-bottom: 1px solid #e5e7eb; text-transform: uppercase; letter-spacing: 0.04em; }
        .table td { padding: 0.75rem 1.125rem; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
        .table tr:last-child td { border-bottom: none; }
        .table tbody tr:hover { background: #fafafa; }

        .doc-name-cell { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
        .doc-icon { width: 14px; height: 14px; color: #9ca3af; flex-shrink: 0; }
        .doc-name-cell:hover .doc-title { color: #7c3aed; }
        .doc-name-cell:hover .doc-icon { color: #7c3aed; }
        .doc-title { font-size: 0.875rem; font-weight: 500; color: #111; }
        .doc-description { font-size: 0.8rem; color: #9ca3af; }

        .actions { display: flex; gap: 0.375rem; }
        .action-btn { padding: 0.35rem 0.75rem; font-size: 0.775rem; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; transition: all 0.15s; white-space: nowrap; background: #fff; }
        .share-btn { color: #6b7280; }
        .share-btn:hover { background: #f3f4f6; }
        .open-btn { background: #7c3aed; color: #fff; border-color: #7c3aed; }
        .open-btn:hover { background: #6d28d9; }
        .action-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .empty-state { text-align: center; padding: 2rem; color: #9ca3af; font-size: 0.875rem; }

        .loading-dots { display: flex; gap: 0.4rem; justify-content: center; padding: 4rem; }
        .loading-dots span { width: 8px; height: 8px; border-radius: 50%; background: #7c3aed; animation: bounce 0.8s infinite; }
        .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-8px); } }

        .toast { position: fixed; bottom: 2rem; right: 2rem; background: #10b981; color: #fff; padding: 0.875rem 1.25rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: slideIn 0.3s ease-out; z-index: 2000; font-size: 0.875rem; }
        @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>

      <div className="docs-page">
        <div className="docs-header">
          <h1>Documents</h1>
          <p>Company resources and reference documents</p>
        </div>

        {loading ? (
          <div className="loading-dots"><span /><span /><span /></div>
        ) : sections.length === 0 ? (
          <div className="empty-state">No documents have been added yet.</div>
        ) : (
          sections.map(section => {
            const selectedFolderId = selectedFolders[section.id]
            const selectedFolder = section.folders.find(f => f.id === selectedFolderId)
            const totalDocs = section.folders.reduce((n, f) => n + f.documents.length, 0)

            return (
              <div key={section.id} className="section-block">
                <div className="section-title">
                  <Link href={`/documents/${section.name.toLowerCase().replace(/[\s-]+/g, '')}`} className="section-title-link">
                    <div className="section-icon">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                    </div>
                    {section.name}
                  </Link>
                  <span style={{ marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 400, color: '#9ca3af' }}>
                    {totalDocs} doc{totalDocs !== 1 ? 's' : ''}
                  </span>
                </div>

                {section.folders.length === 0 ? (
                  <div className="empty-state">No folders in this section.</div>
                ) : (
                  <>
                    <div className="tabs-row">
                      {section.folders.map(folder => (
                        <button
                          key={folder.id}
                          className={`tab${selectedFolderId === folder.id ? ' active' : ''}`}
                          onClick={() => setSelectedFolders(prev => ({ ...prev, [section.id]: folder.id }))}
                        >
                          {folder.name}
                          {folder.documents.length > 0 && (
                            <span style={{ marginLeft: '0.375rem', fontSize: '0.7rem', color: 'inherit', opacity: 0.65 }}>
                              ({folder.documents.length})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {selectedFolder && (
                      selectedFolder.documents.length > 0 ? (
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
                                <DocRow
                                  key={doc.id}
                                  doc={doc}
                                  onShareCopied={() => showToast('Link copied to clipboard')}
                                />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="empty-state">No documents in this folder.</div>
                      )
                    )}
                  </>
                )}
              </div>
            )
          })
        )}
      </div>

      {toastMsg && <div className="toast">{toastMsg}</div>}
    </>
  )
}

function DocRow({ doc, onShareCopied }: { doc: DriveDocument; onShareCopied: () => void }) {
  const [fetching, setFetching] = useState(false)

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

  // Share link: try to derive section slug from folder path — use generic /documents link as fallback
  async function handleShare() {
    // The /documents page doesn't have section-based deep links, so we just copy the open URL approach
    // Users can navigate to the section page for a shareable deep link
    const shareUrl = `${window.location.origin}/documents`
    await navigator.clipboard.writeText(shareUrl)
    onShareCopied()
  }

  const isUploaded = !!doc.storage_path

  return (
    <tr>
      <td>
        <div className="doc-name-cell" onClick={handleOpen}>
          {isUploaded ? (
            <svg className="doc-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
          ) : (
            <svg className="doc-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          )}
          <div>
            <div className="doc-title">{doc.title}{fetching ? ' …' : ''}</div>
            {doc.description && <div className="doc-description">{doc.description}</div>}
          </div>
        </div>
      </td>
      <td className="doc-description">{doc.description || '—'}</td>
      <td>
        <div className="actions">
          <button className="action-btn share-btn" onClick={handleShare} title="Copy link">Share</button>
          <button className="action-btn open-btn" onClick={handleOpen} disabled={fetching}>
            {fetching ? '…' : 'Open'}
          </button>
        </div>
      </td>
    </tr>
  )
}
