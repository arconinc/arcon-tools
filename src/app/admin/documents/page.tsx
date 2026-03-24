'use client'

import { useState, useEffect } from 'react'
import Script from 'next/script'
import type { DocSectionWithFolders, DocFolderWithDocuments, DriveDocument } from '@/types'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gapi: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any
  }
}

interface AddDocForm {
  folderId: string
  title: string
  drive_url: string
  drive_file_id: string
  description: string
}

export default function DocumentsAdminPage() {
  const [sections, setSections] = useState<DocSectionWithFolders[]>([])
  const [loading, setLoading] = useState(true)
  const [gapiReady, setGapiReady] = useState(false)
  const [gisReady, setGisReady] = useState(false)

  // Inline edit state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingSectionName, setEditingSectionName] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')

  // Add section
  const [addSectionName, setAddSectionName] = useState('')
  const [addingSectionLoading, setAddingSectionLoading] = useState(false)

  // Add folder state: keyed by sectionId
  const [addFolderState, setAddFolderState] = useState<Record<string, { name: string; loading: boolean }>>({})
  const [showAddFolderFor, setShowAddFolderFor] = useState<string | null>(null)

  // Add document state
  const [addDocForm, setAddDocForm] = useState<AddDocForm | null>(null)
  const [addDocLoading, setAddDocLoading] = useState(false)

  // Collapsed state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadTree()
  }, [])

  async function loadTree() {
    setLoading(true)
    const res = await fetch('/api/documents')
    const data = await res.json()
    setSections(data.sections ?? [])
    setLoading(false)
  }

  function handleGapiLoad() {
    window.gapi.load('picker', () => setGapiReady(true))
  }

  function openDrivePicker(folderId: string) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

    if (!apiKey || !clientId || !gapiReady || !gisReady) {
      // Fall back to manual entry if env vars or scripts aren't ready
      setAddDocForm({ folderId, title: '', drive_url: '', drive_file_id: '', description: '' })
      return
    }

    // Use Google Identity Services to get a Drive-scoped token on demand.
    // This prompts the user to grant Drive access only when needed (admin only).
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (tokenResponse: { access_token: string }) => {
        const picker = new window.google.picker.PickerBuilder()
          .setDeveloperKey(apiKey)
          .setOAuthToken(tokenResponse.access_token)
          .addView(new window.google.picker.DocsView())
          .setCallback((data: { action: string; docs: Array<{ id: string; name: string; url: string }> }) => {
            if (data.action === window.google.picker.Action.PICKED) {
              const file = data.docs[0]
              setAddDocForm({
                folderId,
                title: file.name,
                drive_url: file.url,
                drive_file_id: file.id,
                description: '',
              })
            }
          })
          .build()
        picker.setVisible(true)
      },
    })
    tokenClient.requestAccessToken()
  }

  // ─── Section CRUD ────────────────────────────────────────────────────────────

  async function addSection() {
    if (!addSectionName.trim()) return
    setAddingSectionLoading(true)
    await fetch('/api/admin/documents/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addSectionName.trim(), sort_order: sections.length }),
    })
    setAddSectionName('')
    setAddingSectionLoading(false)
    loadTree()
  }

  async function saveSection(id: string) {
    if (!editingSectionName.trim()) return
    await fetch(`/api/admin/documents/sections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingSectionName.trim() }),
    })
    setEditingSectionId(null)
    loadTree()
  }

  async function deleteSection(id: string, name: string) {
    if (!confirm(`Delete section "${name}" and all its folders and documents?`)) return
    await fetch(`/api/admin/documents/sections/${id}`, { method: 'DELETE' })
    loadTree()
  }

  // ─── Folder CRUD ─────────────────────────────────────────────────────────────

  async function addFolder(sectionId: string) {
    const state = addFolderState[sectionId]
    if (!state?.name.trim()) return
    setAddFolderState(prev => ({ ...prev, [sectionId]: { ...prev[sectionId], loading: true } }))
    const section = sections.find(s => s.id === sectionId)
    await fetch('/api/admin/documents/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: state.name.trim(), section_id: sectionId, sort_order: section?.folders.length ?? 0 }),
    })
    setAddFolderState(prev => ({ ...prev, [sectionId]: { name: '', loading: false } }))
    setShowAddFolderFor(null)
    loadTree()
  }

  async function saveFolder(id: string) {
    if (!editingFolderName.trim()) return
    await fetch(`/api/admin/documents/folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingFolderName.trim() }),
    })
    setEditingFolderId(null)
    loadTree()
  }

  async function deleteFolder(id: string, name: string) {
    if (!confirm(`Delete folder "${name}" and all its documents?`)) return
    await fetch(`/api/admin/documents/folders/${id}`, { method: 'DELETE' })
    loadTree()
  }

  // ─── Document CRUD ───────────────────────────────────────────────────────────

  async function saveDoc() {
    if (!addDocForm || !addDocForm.title.trim() || !addDocForm.drive_url.trim()) return
    setAddDocLoading(true)
    const folder = sections.flatMap(s => s.folders).find(f => f.id === addDocForm.folderId)
    await fetch('/api/admin/documents/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: addDocForm.title.trim(),
        drive_url: addDocForm.drive_url.trim(),
        drive_file_id: addDocForm.drive_file_id || null,
        description: addDocForm.description.trim() || null,
        folder_id: addDocForm.folderId,
        sort_order: folder?.documents.length ?? 0,
      }),
    })
    setAddDocForm(null)
    setAddDocLoading(false)
    loadTree()
  }

  async function deleteDoc(id: string, title: string) {
    if (!confirm(`Remove "${title}"?`)) return
    await fetch(`/api/admin/documents/items/${id}`, { method: 'DELETE' })
    loadTree()
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Script
        src="https://apis.google.com/js/api.js"
        strategy="lazyOnload"
        onLoad={handleGapiLoad}
      />
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="lazyOnload"
        onLoad={() => setGisReady(true)}
      />
      <style>{`
        .da-page { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem; }
        .da-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.75rem; }
        .da-header h1 { font-size: 1.6rem; font-weight: 700; color: #111; margin: 0; }

        .da-section { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 1.25rem; overflow: hidden; }
        .da-section-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.9rem 1.25rem; background: #fafafa; border-bottom: 1px solid #e5e7eb; }
        .da-section-title { font-weight: 600; font-size: 1rem; color: #111; flex: 1; }
        .da-section-body { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }

        .da-folder { border: 1px solid #f3f4f6; border-radius: 8px; overflow: hidden; }
        .da-folder-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.875rem; background: #f9fafb; }
        .da-folder-title { font-size: 0.875rem; font-weight: 600; color: #374151; flex: 1; }

        .da-doc-list { padding: 0.25rem 0; }
        .da-doc-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.875rem 0.45rem 1.5rem; }
        .da-doc-row:hover { background: #f9fafb; }
        .da-doc-title { font-size: 0.85rem; color: #374151; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .da-doc-url { font-size: 0.75rem; color: #9ca3af; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .da-doc-open { font-size: 0.75rem; color: #7c3aed; text-decoration: none; }
        .da-doc-open:hover { text-decoration: underline; }

        .da-btn { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.8rem; font-weight: 500; cursor: pointer; border: none; transition: background 0.15s; }
        .da-btn-primary { background: #7c3aed; color: #fff; }
        .da-btn-primary:hover { background: #6d28d9; }
        .da-btn-primary:disabled { background: #c4b5fd; cursor: not-allowed; }
        .da-btn-ghost { background: transparent; color: #6b7280; }
        .da-btn-ghost:hover { background: #f3f4f6; color: #374151; }
        .da-btn-danger { background: transparent; color: #ef4444; }
        .da-btn-danger:hover { background: #fef2f2; }
        .da-btn-sm { padding: 0.2rem 0.5rem; font-size: 0.75rem; }

        .da-inline-input { border: 1px solid #d1d5db; border-radius: 6px; padding: 0.3rem 0.6rem; font-size: 0.875rem; outline: none; }
        .da-inline-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124,58,237,0.15); }

        .da-add-section { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem; }
        .da-add-section input { flex: 1; }
        .da-add-folder-row { display: flex; gap: 0.5rem; align-items: center; padding: 0.5rem 0.875rem; background: #f9fafb; border-top: 1px dashed #e5e7eb; }
        .da-add-folder-row input { flex: 1; }

        .da-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .da-modal { background: #fff; border-radius: 12px; padding: 1.5rem; width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .da-modal h2 { font-size: 1.1rem; font-weight: 700; margin: 0 0 1rem; }
        .da-field { margin-bottom: 1rem; }
        .da-field label { display: block; font-size: 0.8rem; font-weight: 600; color: #374151; margin-bottom: 0.3rem; }
        .da-field input, .da-field textarea { width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 0.45rem 0.75rem; font-size: 0.875rem; outline: none; box-sizing: border-box; }
        .da-field input:focus, .da-field textarea:focus { border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124,58,237,0.15); }
        .da-modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.25rem; }
        .da-modal-cancel { padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; font-size: 0.875rem; }
        .da-modal-cancel:hover { background: #f9fafb; }
        .da-picker-hint { font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; }

        .da-collapse-btn { background: none; border: none; cursor: pointer; color: #9ca3af; padding: 0; display: flex; }
        .da-collapse-btn svg { transition: transform 0.2s; }
        .da-collapse-btn.open svg { transform: rotate(90deg); }
      `}</style>

      <div className="da-page">
        <div className="da-header">
          <h1>Documents Manager</h1>
        </div>

        {loading ? (
          <p style={{ color: '#9ca3af' }}>Loading...</p>
        ) : (
          <>
            {sections.map(section => {
              const isCollapsed = collapsedSections.has(section.id)
              return (
                <div key={section.id} className="da-section">
                  <div className="da-section-header">
                    <button
                      className={`da-collapse-btn${isCollapsed ? '' : ' open'}`}
                      onClick={() => setCollapsedSections(prev => {
                        const next = new Set(prev)
                        next.has(section.id) ? next.delete(section.id) : next.add(section.id)
                        return next
                      })}
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                    </button>

                    {editingSectionId === section.id ? (
                      <>
                        <input
                          className="da-inline-input"
                          value={editingSectionName}
                          onChange={e => setEditingSectionName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveSection(section.id); if (e.key === 'Escape') setEditingSectionId(null) }}
                          autoFocus
                        />
                        <button className="da-btn da-btn-primary da-btn-sm" onClick={() => saveSection(section.id)}>Save</button>
                        <button className="da-btn da-btn-ghost da-btn-sm" onClick={() => setEditingSectionId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <span className="da-section-title">{section.name}</span>
                        <button className="da-btn da-btn-ghost da-btn-sm" onClick={() => { setEditingSectionId(section.id); setEditingSectionName(section.name) }}>
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          Rename
                        </button>
                        <button className="da-btn da-btn-danger da-btn-sm" onClick={() => deleteSection(section.id, section.name)}>
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          Delete
                        </button>
                      </>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="da-section-body">
                      {section.folders.map(folder => (
                        <FolderEditor
                          key={folder.id}
                          folder={folder}
                          isEditingFolder={editingFolderId === folder.id}
                          editingFolderName={editingFolderName}
                          onEditStart={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name) }}
                          onEditChange={setEditingFolderName}
                          onEditSave={() => saveFolder(folder.id)}
                          onEditCancel={() => setEditingFolderId(null)}
                          onDelete={() => deleteFolder(folder.id, folder.name)}
                          onAddDoc={() => openDrivePicker(folder.id)}
                          onDeleteDoc={deleteDoc}
                        />
                      ))}

                      {showAddFolderFor === section.id ? (
                        <div className="da-add-folder-row" style={{ borderRadius: 8, border: '1px dashed #e5e7eb', background: '#f9fafb' }}>
                          <input
                            className="da-inline-input"
                            placeholder="Folder name"
                            value={addFolderState[section.id]?.name ?? ''}
                            onChange={e => setAddFolderState(prev => ({ ...prev, [section.id]: { ...prev[section.id], name: e.target.value } }))}
                            onKeyDown={e => { if (e.key === 'Enter') addFolder(section.id); if (e.key === 'Escape') setShowAddFolderFor(null) }}
                            autoFocus
                          />
                          <button
                            className="da-btn da-btn-primary da-btn-sm"
                            disabled={addFolderState[section.id]?.loading}
                            onClick={() => addFolder(section.id)}
                          >Add</button>
                          <button className="da-btn da-btn-ghost da-btn-sm" onClick={() => setShowAddFolderFor(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button
                          className="da-btn da-btn-ghost"
                          style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}
                          onClick={() => { setShowAddFolderFor(section.id); setAddFolderState(prev => ({ ...prev, [section.id]: { name: '', loading: false } })) }}
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          Add Folder
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            <div className="da-add-section">
              <input
                className="da-inline-input"
                placeholder="New section name (e.g. HR, Finance)"
                value={addSectionName}
                onChange={e => setAddSectionName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addSection() }}
              />
              <button
                className="da-btn da-btn-primary"
                disabled={addingSectionLoading || !addSectionName.trim()}
                onClick={addSection}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Section
              </button>
            </div>
          </>
        )}
      </div>

      {/* Add Document Modal */}
      {addDocForm && (
        <div className="da-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setAddDocForm(null) }}>
          <div className="da-modal">
            <h2>Add Document</h2>
            <div className="da-field">
              <label>Title</label>
              <input
                value={addDocForm.title}
                onChange={e => setAddDocForm(prev => prev ? { ...prev, title: e.target.value } : prev)}
                placeholder="e.g. PTO Policy 2025"
                autoFocus
              />
            </div>
            <div className="da-field">
              <label>Google Drive URL</label>
              <input
                value={addDocForm.drive_url}
                onChange={e => setAddDocForm(prev => prev ? { ...prev, drive_url: e.target.value } : prev)}
                placeholder="https://docs.google.com/..."
              />
              {!addDocForm.drive_file_id && (
                <p className="da-picker-hint">Paste a Google Drive share link, or use the Drive Picker button below.</p>
              )}
            </div>
            <div className="da-field">
              <label>Description (optional)</label>
              <input
                value={addDocForm.description}
                onChange={e => setAddDocForm(prev => prev ? { ...prev, description: e.target.value } : prev)}
                placeholder="Brief description"
              />
            </div>
            <div className="da-modal-actions">
              {gapiReady && gisReady && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                <button
                  className="da-btn da-btn-ghost"
                  onClick={() => {
                    const folderId = addDocForm.folderId
                    setAddDocForm(null)
                    setTimeout(() => openDrivePicker(folderId), 50)
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z"/></svg>
                  Browse Drive
                </button>
              )}
              <button className="da-modal-cancel" onClick={() => setAddDocForm(null)}>Cancel</button>
              <button
                className="da-btn da-btn-primary"
                disabled={addDocLoading || !addDocForm.title.trim() || !addDocForm.drive_url.trim()}
                onClick={saveDoc}
              >
                {addDocLoading ? 'Saving...' : 'Save Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function FolderEditor({
  folder,
  isEditingFolder,
  editingFolderName,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDelete,
  onAddDoc,
  onDeleteDoc,
}: {
  folder: DocFolderWithDocuments
  isEditingFolder: boolean
  editingFolderName: string
  onEditStart: () => void
  onEditChange: (v: string) => void
  onEditSave: () => void
  onEditCancel: () => void
  onDelete: () => void
  onAddDoc: () => void
  onDeleteDoc: (id: string, title: string) => void
}) {
  return (
    <div className="da-folder">
      <div className="da-folder-header">
        <svg width="15" height="15" fill="#f59e0b" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>

        {isEditingFolder ? (
          <>
            <input
              className="da-inline-input"
              value={editingFolderName}
              onChange={e => onEditChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel() }}
              autoFocus
            />
            <button className="da-btn da-btn-primary da-btn-sm" onClick={onEditSave}>Save</button>
            <button className="da-btn da-btn-ghost da-btn-sm" onClick={onEditCancel}>Cancel</button>
          </>
        ) : (
          <>
            <span className="da-folder-title">{folder.name}</span>
            <button className="da-btn da-btn-ghost da-btn-sm" onClick={onEditStart}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button className="da-btn da-btn-danger da-btn-sm" onClick={onDelete}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            <button className="da-btn da-btn-primary da-btn-sm" onClick={onAddDoc} style={{ marginLeft: 'auto' }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Doc
            </button>
          </>
        )}
      </div>

      <div className="da-doc-list">
        {folder.documents.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: '#d1d5db', padding: '0.4rem 1.5rem', margin: 0 }}>No documents yet</p>
        ) : (
          folder.documents.map(doc => (
            <DocRow key={doc.id} doc={doc} onDelete={() => onDeleteDoc(doc.id, doc.title)} />
          ))
        )}
      </div>
    </div>
  )
}

function DocRow({ doc, onDelete }: { doc: DriveDocument; onDelete: () => void }) {
  return (
    <div className="da-doc-row">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9ca3af"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      <span className="da-doc-title">{doc.title}</span>
      {doc.description && <span className="da-doc-url">{doc.description}</span>}
      <a className="da-doc-open" href={doc.drive_url} target="_blank" rel="noopener noreferrer">Open</a>
      <button className="da-btn da-btn-danger da-btn-sm" onClick={onDelete}>
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  )
}
