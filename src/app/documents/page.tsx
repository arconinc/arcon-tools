'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { DocSectionWithTree, DocFolderNode } from '@/types'

function countFolders(folders: DocFolderNode[]): number {
  let n = 0
  for (const f of folders) {
    n += 1 + countFolders(f.children)
  }
  return n
}

function countDocs(folders: DocFolderNode[]): number {
  let n = 0
  for (const f of folders) {
    n += f.documents.length + countDocs(f.children)
  }
  return n
}

const SECTION_SLUGS: Record<string, string> = {
  'HR': 'hr',
  'Marketing': 'marketing',
  'Accounting': 'accounting',
  'E-Commerce': 'ecommerce',
  'Technology': 'technology',
  'Sales': 'sales',
  'Warehouse': 'warehouse',
}

export default function DocumentsPage() {
  const [sections, setSections] = useState<DocSectionWithTree[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(data => setSections(data.sections ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <style>{`
        .docs-overview { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
        .docs-overview-header { margin-bottom: 2rem; }
        .docs-overview-header h1 { font-size: 1.75rem; font-weight: 700; color: #111; margin: 0 0 0.25rem; }
        .docs-overview-header p { color: #666; margin: 0; font-size: 0.9rem; }

        .sections-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }

        .section-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.25rem 1.375rem; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 0.75rem; transition: all 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .section-card:hover { border-color: #7c3aed; box-shadow: 0 4px 12px rgba(124,58,237,0.12); transform: translateY(-1px); }

        .section-card-icon { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #7c3aed, #6d28d9); display: flex; align-items: center; justify-content: center; }
        .section-card-icon svg { width: 18px; height: 18px; color: #fff; }

        .section-card-name { font-size: 1rem; font-weight: 700; color: #111; margin: 0; }
        .section-card-meta { display: flex; gap: 0.75rem; }
        .section-card-stat { font-size: 0.8rem; color: #9ca3af; display: flex; align-items: center; gap: 0.3rem; }
        .section-card-stat svg { width: 13px; height: 13px; }

        .loading-dots { display: flex; gap: 0.4rem; justify-content: center; padding: 4rem; }
        .loading-dots span { width: 8px; height: 8px; border-radius: 50%; background: #7c3aed; animation: bounce 0.8s infinite; }
        .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-8px); } }

        .empty-state { text-align: center; padding: 4rem; color: #9ca3af; font-size: 0.875rem; }
      `}</style>

      <div className="docs-overview">
        <div className="docs-overview-header">
          <h1>Documents</h1>
          <p>Company resources and reference documents</p>
        </div>

        {loading ? (
          <div className="loading-dots"><span /><span /><span /></div>
        ) : sections.length === 0 ? (
          <div className="empty-state">No documents have been added yet.</div>
        ) : (
          <div className="sections-grid">
            {sections.map(section => {
              const slug = SECTION_SLUGS[section.name] ?? section.name.toLowerCase().replace(/[\s-]+/g, '')
              const folderCount = countFolders(section.folders)
              const docCount = countDocs(section.folders)
              return (
                <Link key={section.id} href={`/documents/${slug}`} className="section-card">
                  <div className="section-card-icon">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                  </div>
                  <p className="section-card-name">{section.name}</p>
                  <div className="section-card-meta">
                    <span className="section-card-stat">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                      {folderCount} folder{folderCount !== 1 ? 's' : ''}
                    </span>
                    <span className="section-card-stat">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      {docCount} doc{docCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
