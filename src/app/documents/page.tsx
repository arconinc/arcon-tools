'use client'

import { useState, useEffect } from 'react'
import type { DocSectionWithFolders, DocFolderWithDocuments, DriveDocument } from '@/types'

export default function DocumentsPage() {
  const [sections, setSections] = useState<DocSectionWithFolders[]>([])
  const [loading, setLoading] = useState(true)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(data => {
        const secs: DocSectionWithFolders[] = data.sections ?? []
        setSections(secs)
        // Open all sections by default
        setOpenSections(new Set(secs.map(s => s.id)))
        // Open all folders by default
        const folderIds = secs.flatMap(s => s.folders.map(f => f.id))
        setOpenFolders(new Set(folderIds))
      })
      .finally(() => setLoading(false))
  }, [])

  function toggleSection(id: string) {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleFolder(id: string) {
    setOpenFolders(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <>
      <style>{`
        .docs-page { max-width: 860px; margin: 0 auto; padding: 2rem 1.5rem; }
        .docs-header { margin-bottom: 2rem; }
        .docs-header h1 { font-size: 1.75rem; font-weight: 700; color: #111; margin: 0 0 0.25rem; }
        .docs-header p { color: #666; margin: 0; font-size: 0.9rem; }

        .section-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 1.25rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .section-header { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; cursor: pointer; user-select: none; background: #fafafa; border-bottom: 1px solid #e5e7eb; }
        .section-header:hover { background: #f3f4f6; }
        .section-chevron { width: 18px; height: 18px; color: #9ca3af; transition: transform 0.2s; flex-shrink: 0; }
        .section-chevron.open { transform: rotate(90deg); }
        .section-icon { width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #7c3aed, #6d28d9); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .section-icon svg { width: 16px; height: 16px; color: #fff; }
        .section-name { font-weight: 600; font-size: 1rem; color: #111; }
        .section-count { margin-left: auto; font-size: 0.8rem; color: #9ca3af; }

        .section-body { padding: 0.75rem 1.25rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }

        .folder-block { border: 1px solid #f3f4f6; border-radius: 8px; overflow: hidden; }
        .folder-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.875rem; cursor: pointer; user-select: none; background: #f9fafb; }
        .folder-header:hover { background: #f3f4f6; }
        .folder-chevron { width: 14px; height: 14px; color: #d1d5db; transition: transform 0.2s; flex-shrink: 0; }
        .folder-chevron.open { transform: rotate(90deg); }
        .folder-icon { color: #f59e0b; flex-shrink: 0; }
        .folder-name { font-size: 0.875rem; font-weight: 600; color: #374151; }
        .folder-doc-count { margin-left: auto; font-size: 0.75rem; color: #9ca3af; }

        .folder-docs { padding: 0.25rem 0; }
        .doc-link { display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0.875rem 0.5rem 2.25rem; text-decoration: none; color: inherit; transition: background 0.15s; }
        .doc-link:hover { background: #f5f3ff; }
        .doc-link:hover .doc-title { color: #7c3aed; }
        .doc-icon { flex-shrink: 0; width: 18px; height: 18px; color: #6b7280; }
        .doc-link:hover .doc-icon { color: #7c3aed; }
        .doc-title { font-size: 0.875rem; color: #374151; }
        .doc-description { font-size: 0.75rem; color: #9ca3af; margin-top: 1px; }
        .doc-ext-icon { margin-left: auto; flex-shrink: 0; width: 14px; height: 14px; color: #d1d5db; }

        .empty-state { text-align: center; padding: 4rem 2rem; color: #9ca3af; }
        .empty-state svg { width: 48px; height: 48px; margin: 0 auto 1rem; display: block; color: #e5e7eb; }

        .loading-dots { display: flex; gap: 0.4rem; justify-content: center; padding: 4rem; }
        .loading-dots span { width: 8px; height: 8px; border-radius: 50%; background: #7c3aed; animation: bounce 0.8s infinite; }
        .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-8px); } }
      `}</style>

      <div className="docs-page">
        <div className="docs-header">
          <h1>Documents</h1>
          <p>Company resources and reference documents</p>
        </div>

        {loading ? (
          <div className="loading-dots">
            <span /><span /><span />
          </div>
        ) : sections.length === 0 ? (
          <div className="empty-state">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
            <p>No documents have been added yet.</p>
          </div>
        ) : (
          sections.map(section => {
            const sectionOpen = openSections.has(section.id)
            const totalDocs = section.folders.reduce((n, f) => n + f.documents.length, 0)
            return (
              <div key={section.id} className="section-card">
                <div className="section-header" onClick={() => toggleSection(section.id)}>
                  <svg className={`section-chevron${sectionOpen ? ' open' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                  <div className="section-icon">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                  </div>
                  <span className="section-name">{section.name}</span>
                  <span className="section-count">{totalDocs} doc{totalDocs !== 1 ? 's' : ''}</span>
                </div>

                {sectionOpen && (
                  <div className="section-body">
                    {section.folders.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '0.5rem 0' }}>No folders yet.</p>
                    ) : (
                      section.folders.map(folder => (
                        <FolderBlock
                          key={folder.id}
                          folder={folder}
                          isOpen={openFolders.has(folder.id)}
                          onToggle={() => toggleFolder(folder.id)}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

function FolderBlock({
  folder,
  isOpen,
  onToggle,
}: {
  folder: DocFolderWithDocuments
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="folder-block">
      <div className="folder-header" onClick={onToggle}>
        <svg className={`folder-chevron${isOpen ? ' open' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
        <svg className="folder-icon" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>
        <span className="folder-name">{folder.name}</span>
        <span className="folder-doc-count">{folder.documents.length}</span>
      </div>

      {isOpen && (
        <div className="folder-docs">
          {folder.documents.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', padding: '0.5rem 2.25rem' }}>No documents.</p>
          ) : (
            folder.documents.map(doc => <DocItem key={doc.id} doc={doc} />)
          )}
        </div>
      )}
    </div>
  )
}

function DocItem({ doc }: { doc: DriveDocument }) {
  return (
    <a className="doc-link" href={doc.drive_url} target="_blank" rel="noopener noreferrer">
      <svg className="doc-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      <div>
        <div className="doc-title">{doc.title}</div>
        {doc.description && <div className="doc-description">{doc.description}</div>}
      </div>
      <svg className="doc-ext-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
    </a>
  )
}
