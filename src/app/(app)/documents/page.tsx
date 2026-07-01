'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import type { DocSectionWithTree, DocFolderNode, DriveDocument } from '@/types'

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

interface SearchResult {
  doc: DriveDocument
  sectionSlug: string
  sectionName: string
  folderId: string
  path: string
}

function searchFolders(
  nodes: DocFolderNode[],
  query: string,
  sectionSlug: string,
  sectionName: string,
  parentPath: string[],
  out: SearchResult[]
) {
  for (const node of nodes) {
    const path = [...parentPath, node.name]
    for (const doc of node.documents) {
      if (doc.title.toLowerCase().includes(query) || doc.description?.toLowerCase().includes(query)) {
        out.push({ doc, sectionSlug, sectionName, folderId: node.id, path: path.join(' / ') })
      }
    }
    if (node.children.length > 0) searchFolders(node.children, query, sectionSlug, sectionName, path, out)
  }
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
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(data => setSections(data.sections ?? []))
      .finally(() => setLoading(false))
  }, [])

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return null
    const out: SearchResult[] = []
    for (const section of sections) {
      const slug = SECTION_SLUGS[section.name] ?? section.name.toLowerCase().replace(/[\s-]+/g, '')
      searchFolders(section.folders, query, slug, section.name, [], out)
    }
    return out
  }, [searchQuery, sections])

  return (
    <>
      <style>{`
        .docs-overview { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
        .docs-overview-header { margin-bottom: 2rem; }
        .docs-overview-header h1 { font-size: 1.75rem; font-weight: 700; color: #111; margin: 0 0 0.25rem; }
        .docs-overview-header p { color: #6b7280; margin: 0; font-size: 0.9rem; }

        .sections-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }

        .section-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.25rem 1.375rem; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 0.75rem; transition: all 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .section-card:hover { border-color: #7c3aed; box-shadow: 0 4px 12px rgba(124,58,237,0.12); transform: translateY(-1px); }

        .section-card-icon { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #7c3aed, #5b21b6); display: flex; align-items: center; justify-content: center; }
        .section-card-icon svg { width: 18px; height: 18px; color: #fff; }

        .section-card-name { font-size: 1rem; font-weight: 700; color: #111; margin: 0; }
        .section-card-meta { display: flex; gap: 0.75rem; }
        .section-card-stat { font-size: 0.8rem; color: #9ca3af; display: flex; align-items: center; gap: 0.3rem; }
        .section-card-stat svg { width: 13px; height: 13px; }

        .section-card-skeleton { background: #f3e8ff; border-radius: 10px; height: 100px; animation: skpulse 1.5s ease-in-out infinite; }
        @keyframes skpulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

        .empty-state { text-align: center; padding: 4rem; color: #9ca3af; font-size: 0.875rem; }

        .docs-search { position: relative; margin-bottom: 1.5rem; max-width: 480px; }
        .docs-search input { width: 100%; box-sizing: border-box; padding: 0.6rem 0.875rem 0.6rem 2.25rem; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; outline: none; }
        .docs-search input:focus { border-color: #7c3aed; }
        .docs-search svg { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #9ca3af; width: 16px; height: 16px; }

        .search-results-list { display: flex; flex-direction: column; gap: 0.625rem; }
        .search-result-card { display: flex; align-items: flex-start; gap: 0.625rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.875rem 1rem; text-decoration: none; color: inherit; transition: all 0.15s; }
        .search-result-card:hover { border-color: #7c3aed; box-shadow: 0 2px 8px rgba(124,58,237,0.1); }
        .search-result-card svg.doc-icon { width: 16px; height: 16px; color: #9ca3af; flex-shrink: 0; margin-top: 2px; }
        .search-result-title { font-size: 0.9rem; font-weight: 600; color: #111; }
        .search-result-desc { font-size: 0.8rem; color: #6b7280; margin-top: 0.15rem; }
        .search-result-path { font-size: 0.75rem; color: #7c3aed; margin-top: 0.3rem; }
      `}</style>

      <div className="docs-overview">
        <div className="docs-overview-header">
          <h1>Documents</h1>
          <p>Company resources and reference documents</p>
        </div>

        <div className="docs-search">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" /></svg>
          <input
            type="text"
            placeholder="Search all documents by name or description…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="sections-grid">
            {[...Array(4)].map((_, i) => <div key={i} className="section-card-skeleton" />)}
          </div>
        ) : searchResults !== null ? (
          searchResults.length === 0 ? (
            <div className="empty-state">No documents match &ldquo;{searchQuery}&rdquo;.</div>
          ) : (
            <div className="search-results-list">
              {searchResults.map(r => (
                <Link
                  key={r.doc.id}
                  href={`/documents/${r.sectionSlug}?folder=${r.folderId}&doc=${r.doc.id}`}
                  className="search-result-card"
                >
                  <svg className="doc-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <div>
                    <div className="search-result-title">{r.doc.title}</div>
                    {r.doc.description && <div className="search-result-desc">{r.doc.description}</div>}
                    <div className="search-result-path">{r.sectionName} / {r.path}</div>
                  </div>
                </Link>
              ))}
            </div>
          )
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
