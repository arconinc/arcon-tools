'use client'

import { useState, useEffect, useRef } from 'react'
import Script from 'next/script'
import { useParams, useSearchParams } from 'next/navigation'
import type { DocSectionWithFolders, DocFolderWithDocuments, DriveDocument } from '@/types'
import { PermissionModal } from '@/components/documents/PermissionModal'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gapi: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any
  }
}

const SECTION_MAP: Record<string, string> = {
  hr: 'HR',
  marketing: 'Marketing',
  accounting: 'Accounting',
  ecommerce: 'E-Commerce',
  technology: 'Technology',
  sales: 'Sales',
  warehouse: 'Warehouse',
}

type DocSource = 'drive' | 'upload'

interface PermSummaryEntry { roles: string[]; userCount: number; ownerId: string | null }

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
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Management
  const [canManage, setCanManage] = useState(false)
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [permSummary, setPermSummary] = useState<Record<string, PermSummaryEntry>>({})

  // Add folder
  const [showAddFolder, setShowAddFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [addFolderLoading, setAddFolderLoading] = useState(false)

  // Edit folder
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string } | null>(null)
  const [editFolderName, setEditFolderName] = useState('')

  // Add document modal
  const [addDocModal, setAddDocModal] = useState<{ folderId: string } | null>(null)
  const [docSource, setDocSource] = useState<DocSource>('drive')
  const [docTitle, setDocTitle] = useState('')
  const [docDriveUrl, setDocDriveUrl] = useState('')
  const [docDescription, setDocDescription] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [addDocLoading, setAddDocLoading] = useState(false)
  const [addDocError, setAddDocError] = useState<string | null>(null)

  // Edit document modal
  const [editDocModal, setEditDocModal] = useState<DriveDocument | null>(null)
  const [editDocTitle, setEditDocTitle] = useState('')
  const [editDocDescription, setEditDocDescription] = useState('')
  const [editDocLoading, setEditDocLoading] = useState(false)

  // Replace document modal
  const [replaceDocModal, setReplaceDocModal] = useState<DriveDocument | null>(null)
  const [replaceDocSource, setReplaceDocSource] = useState<DocSource>('drive')
  const [replaceDocDriveUrl, setReplaceDocDriveUrl] = useState('')
  const [replaceDocFile, setReplaceDocFile] = useState<File | null>(null)
  const [replaceDocLoading, setReplaceDocLoading] = useState(false)
  const [replaceDocError, setReplaceDocError] = useState<string | null>(null)
  const replaceFileInputRef = useRef<HTMLInputElement>(null)

  // Permission modal
  const [permModal, setPermModal] = useState<DriveDocument | null>(null)

  // Google Drive Picker
  const [gapiReady, setGapiReady] = useState(false)
  const [gisReady, setGisReady] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!sectionName) return
    Promise.all([
      fetch('/api/documents').then(r => r.json()),
      fetch(`/api/documents/manage/check?slug=${sectionSlug}`).then(r => r.json()).catch(() => ({ canManage: false })),
    ]).then(([docsData, manageData]) => {
      const secs: DocSectionWithFolders[] = docsData.sections ?? []
      const targetSection = secs.find(s => s.name === sectionName)
      if (!targetSection) { setNotFound(true); setLoading(false); return }

      setSections([targetSection])
      if (folderParam) {
        const folder = targetSection.folders.find(f => f.id === folderParam)
        setSelectedFolderId(folder ? folderParam : (targetSection.folders[0]?.id ?? null))
      } else {
        setSelectedFolderId(targetSection.folders[0]?.id ?? null)
      }

      const manage = manageData as { canManage: boolean; sectionId: string | null }
      setCanManage(manage.canManage)
      setSectionId(manage.sectionId ?? targetSection.id)

      if (manage.canManage && manage.sectionId) {
        fetch(`/api/documents/manage/permissions-summary?sectionId=${manage.sectionId}`)
          .then(r => r.json())
          .then(d => setPermSummary(d.summary ?? {}))
          .catch(() => {})
      }
    }).catch(() => setNotFound(true)).finally(() => setLoading(false))
  }, [sectionName, sectionSlug, folderParam])

  async function reload() {
    if (!sectionName) return
    const [docsData, permData] = await Promise.all([
      fetch('/api/documents').then(r => r.json()),
      sectionId ? fetch(`/api/documents/manage/permissions-summary?sectionId=${sectionId}`).then(r => r.json()).catch(() => ({ summary: {} })) : Promise.resolve({ summary: {} }),
    ])
    const secs: DocSectionWithFolders[] = docsData.sections ?? []
    const targetSection = secs.find(s => s.name === sectionName)
    if (targetSection) {
      setSections([targetSection])
      if (!targetSection.folders.find(f => f.id === selectedFolderId)) {
        setSelectedFolderId(targetSection.folders[0]?.id ?? null)
      }
    }
    setPermSummary(permData.summary ?? {})
  }

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  // ── Folder CRUD ───────────────────────────────────────────────────────────────

  async function handleAddFolder() {
    if (!newFolderName.trim() || !sectionId) return
    setAddFolderLoading(true)
    const res = await fetch('/api/documents/manage/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: sectionId, name: newFolderName.trim(), sort_order: sections[0]?.folders.length ?? 0 }),
    })
    if (res.ok) {
      const { folder } = await res.json()
      setNewFolderName('')
      setShowAddFolder(false)
      await reload()
      setSelectedFolderId(folder.id)
      showToast('Folder created')
    }
    setAddFolderLoading(false)
  }

  async function handleSaveFolder() {
    if (!editingFolder || !editFolderName.trim()) return
    await fetch(`/api/documents/manage/folders/${editingFolder.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editFolderName.trim() }),
    })
    setEditingFolder(null)
    await reload()
    showToast('Folder renamed')
  }

  async function handleDeleteFolder(folder: DocFolderWithDocuments) {
    if (!confirm(`Delete folder "${folder.name}" and all its documents? This cannot be undone.`)) return
    await fetch(`/api/documents/manage/folders/${folder.id}`, { method: 'DELETE' })
    await reload()
    showToast('Folder deleted')
  }

  // ── Document CRUD ─────────────────────────────────────────────────────────────

  function openAddDoc(folderId: string) {
    setAddDocModal({ folderId })
    setDocSource('drive')
    setDocTitle('')
    setDocDriveUrl('')
    setDocDescription('')
    setDocFile(null)
    setAddDocError(null)
  }

  function openDrivePicker(folderId: string) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!apiKey || !clientId || !gapiReady || !gisReady) return

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
              setAddDocModal({ folderId })
              setDocTitle(file.name ?? '')
              setDocDriveUrl(file.url ?? '')
              setDocSource('drive')
            }
          })
          .build()
        picker.setVisible(true)
      },
    })
    tokenClient.requestAccessToken()
  }

  async function handleSaveDoc() {
    if (!addDocModal || !docTitle.trim()) return
    setAddDocLoading(true)
    setAddDocError(null)

    if (docSource === 'upload') {
      if (!docFile) { setAddDocError('Please select a file.'); setAddDocLoading(false); return }
      const form = new FormData()
      form.append('file', docFile)
      form.append('title', docTitle.trim())
      form.append('folder_id', addDocModal.folderId)
      if (docDescription.trim()) form.append('description', docDescription.trim())
      const res = await fetch('/api/documents/manage/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Upload failed' }))
        setAddDocError(error)
        setAddDocLoading(false)
        return
      }
    } else {
      if (!docDriveUrl.trim()) { setAddDocError('Drive URL is required.'); setAddDocLoading(false); return }
      const res = await fetch('/api/documents/manage/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: addDocModal.folderId, title: docTitle.trim(), drive_url: docDriveUrl.trim(), description: docDescription.trim() || null }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Failed to save document' }))
        setAddDocError(error)
        setAddDocLoading(false)
        return
      }
    }

    setAddDocModal(null)
    await reload()
    showToast('Document added')
    setAddDocLoading(false)
  }

  async function handleDeleteDoc(doc: DriveDocument) {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return
    await fetch(`/api/documents/manage/items/${doc.id}`, { method: 'DELETE' })
    await reload()
    showToast('Document deleted')
  }

  function openReplaceDoc(doc: DriveDocument) {
    setReplaceDocModal(doc)
    setReplaceDocSource(doc.storage_path ? 'upload' : 'drive')
    setReplaceDocDriveUrl('')
    setReplaceDocFile(null)
    setReplaceDocError(null)
  }

  async function handleReplaceDoc() {
    if (!replaceDocModal) return
    setReplaceDocLoading(true)
    setReplaceDocError(null)

    if (replaceDocSource === 'upload') {
      if (!replaceDocFile) { setReplaceDocError('Please select a file.'); setReplaceDocLoading(false); return }
      const form = new FormData()
      form.append('file', replaceDocFile)
      const res = await fetch(`/api/documents/manage/items/${replaceDocModal.id}/replace`, { method: 'POST', body: form })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Replace failed' }))
        setReplaceDocError(error)
        setReplaceDocLoading(false)
        return
      }
    } else {
      if (!replaceDocDriveUrl.trim()) { setReplaceDocError('Drive URL is required.'); setReplaceDocLoading(false); return }
      const res = await fetch(`/api/documents/manage/items/${replaceDocModal.id}/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drive_url: replaceDocDriveUrl.trim() }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Replace failed' }))
        setReplaceDocError(error)
        setReplaceDocLoading(false)
        return
      }
    }

    setReplaceDocModal(null)
    await reload()
    showToast('Document replaced')
    setReplaceDocLoading(false)
  }

  async function handleSaveEditDoc() {
    if (!editDocModal || !editDocTitle.trim()) return
    setEditDocLoading(true)
    await fetch(`/api/documents/manage/items/${editDocModal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editDocTitle.trim(), drive_url: editDocModal.drive_url, description: editDocDescription.trim() || null }),
    })
    setEditDocModal(null)
    setEditDocLoading(false)
    await reload()
    showToast('Document updated')
  }

  function permBadgeText(docId: string): string | null {
    const entry = permSummary[docId]
    if (!entry) return null
    const parts: string[] = []
    if (entry.roles.length > 0) parts.push(entry.roles.join(', '))
    if (entry.userCount > 0) parts.push(`${entry.userCount} user${entry.userCount !== 1 ? 's' : ''}`)
    return parts.length > 0 ? parts.join(' · ') : null
  }

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
          <div className="loading-dots"><span /><span /><span /></div>
        </div>
      </>
    )
  }

  if (notFound || sections.length === 0) {
    return (
      <>
        <style>{`.section-docs-page { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; } .error-state { text-align: center; padding: 4rem 2rem; color: #9ca3af; } .error-state h2 { font-size: 1.25rem; font-weight: 600; color: #111; margin: 0 0 0.5rem; }`}</style>
        <div className="section-docs-page">
          <div className="error-state">
            <h2>Section not found</h2>
            <p>The section &ldquo;{sectionSlug}&rdquo; could not be found or you don&apos;t have access to it.</p>
          </div>
        </div>
      </>
    )
  }

  const section = sections[0]
  const selectedFolder = section.folders.find(f => f.id === selectedFolderId)

  return (
    <>
      {/* Google API scripts for Drive Picker */}
      {canManage && (
        <>
          <Script src="https://apis.google.com/js/api.js" onLoad={() => { window.gapi.load('picker', () => setGapiReady(true)) }} />
          <Script src="https://accounts.google.com/gsi/client" onLoad={() => setGisReady(true)} />
        </>
      )}

      <style>{`
        .section-docs-page { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
        .docs-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 2rem; gap: 1rem; }
        .docs-header-left h1 { font-size: 1.75rem; font-weight: 700; color: #111; margin: 0 0 0.25rem; }
        .docs-header-left p { color: #666; margin: 0; font-size: 0.9rem; }

        .tabs-row { display: flex; align-items: center; gap: 0.5rem; border-bottom: 2px solid #e5e7eb; margin-bottom: 2rem; flex-wrap: wrap; }
        .tab { padding: 0.75rem 1rem; cursor: pointer; font-size: 0.95rem; font-weight: 500; color: #666; border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.2s; white-space: nowrap; background: none; border-top: none; border-left: none; border-right: none; display: flex; align-items: center; gap: 0.375rem; }
        .tab:hover { color: #7c3aed; }
        .tab.active { color: #7c3aed; border-bottom-color: #7c3aed; }
        .tab-edit-btn { background: none; border: none; cursor: pointer; color: #9ca3af; padding: 0.125rem; border-radius: 3px; display: flex; align-items: center; }
        .tab-edit-btn:hover { color: #7c3aed; background: #f5f3ff; }
        .tab-delete-btn { background: none; border: none; cursor: pointer; color: #9ca3af; padding: 0.125rem; border-radius: 3px; display: flex; align-items: center; }
        .tab-delete-btn:hover { color: #ef4444; background: #fef2f2; }

        .add-folder-form { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0 0.5rem; }
        .add-folder-input { padding: 0.4rem 0.625rem; border: 1.5px solid #7c3aed; border-radius: 6px; font-size: 0.85rem; outline: none; width: 180px; }
        .btn-sm { padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 6px; cursor: pointer; border: 1px solid transparent; font-weight: 500; }
        .btn-primary { background: #7c3aed; color: #fff; border-color: #7c3aed; }
        .btn-primary:hover:not(:disabled) { background: #6d28d9; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-secondary { background: #fff; color: #374151; border-color: #e5e7eb; }
        .btn-secondary:hover { background: #f9fafb; }
        .btn-ghost { background: none; border: 1.5px dashed #d1d5db; color: #6b7280; }
        .btn-ghost:hover { border-color: #7c3aed; color: #7c3aed; background: #faf5ff; }

        .table-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
        .table-container { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .table { width: 100%; border-collapse: collapse; }
        .table th { padding: 0.875rem 1.25rem; text-align: left; font-weight: 600; font-size: 0.8rem; color: #6b7280; background: #fafafa; border-bottom: 1px solid #e5e7eb; text-transform: uppercase; letter-spacing: 0.04em; }
        .table td { padding: 0.875rem 1.25rem; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
        .table tr:last-child td { border-bottom: none; }
        .table tbody tr:hover { background: #fafafa; }
        .table tbody tr.highlighted { background: #fef3c7; }
        .table tbody tr.highlighted:hover { background: #fcd34d; }

        .doc-name { font-weight: 500; color: #111; display: flex; align-items: center; gap: 0.5rem; }
        .doc-icon { width: 15px; height: 15px; color: #9ca3af; flex-shrink: 0; }
        .doc-description { color: #9ca3af; font-size: 0.8rem; }
        .perm-badge { display: inline-block; font-size: 0.7rem; color: #7c3aed; background: #ede9fe; border-radius: 10px; padding: 0.15rem 0.5rem; margin-top: 0.2rem; }
        .perm-badge.open { color: #065f46; background: #d1fae5; }

        .actions { display: flex; gap: 0.375rem; align-items: center; }
        .action-btn { padding: 0.4rem 0.875rem; font-size: 0.8rem; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; transition: all 0.15s; white-space: nowrap; background: #fff; }
        .share-btn { color: #6b7280; }
        .share-btn:hover { background: #f3f4f6; }
        .open-btn { background: #7c3aed; color: #fff; border-color: #7c3aed; }
        .open-btn:hover { background: #6d28d9; }
        .action-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .manage-btn { color: #7c3aed; border-color: #e9d5ff; }
        .manage-btn:hover { background: #f5f3ff; border-color: #7c3aed; }
        .danger-btn { color: #ef4444; border-color: #fecaca; }
        .danger-btn:hover { background: #fef2f2; border-color: #ef4444; }

        .empty-state { text-align: center; padding: 3rem 2rem; color: #9ca3af; }
        .empty-state svg { width: 40px; height: 40px; margin: 0 auto 0.75rem; display: block; color: #e5e7eb; }

        .toast { position: fixed; bottom: 2rem; right: 2rem; background: #10b981; color: #fff; padding: 0.875rem 1.25rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: slideIn 0.3s ease-out; z-index: 2000; font-size: 0.875rem; }
        @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal { background: #fff; border-radius: 14px; width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem 1rem; border-bottom: 1px solid #e5e7eb; }
        .modal-header h3 { font-size: 1rem; font-weight: 700; color: #111; margin: 0; }
        .modal-close { background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 1.25rem; padding: 0.25rem; }
        .modal-close:hover { color: #374151; }
        .modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
        .modal-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 1rem 1.5rem; border-top: 1px solid #f3f4f6; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .form-label { font-size: 0.8rem; font-weight: 600; color: #374151; }
        .form-input, .form-textarea { padding: 0.5rem 0.75rem; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 0.875rem; outline: none; width: 100%; box-sizing: border-box; font-family: inherit; }
        .form-input:focus, .form-textarea:focus { border-color: #7c3aed; }
        .form-textarea { resize: vertical; min-height: 70px; }
        .source-tabs { display: flex; border: 1.5px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
        .source-tab { flex: 1; padding: 0.5rem; font-size: 0.85rem; font-weight: 500; text-align: center; cursor: pointer; border: none; background: #fff; color: #6b7280; transition: all 0.15s; }
        .source-tab.active { background: #7c3aed; color: #fff; }
        .error-msg { color: #ef4444; font-size: 0.8rem; }
        .picker-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.875rem; border: 1.5px solid #e5e7eb; border-radius: 8px; background: #fff; font-size: 0.85rem; color: #374151; cursor: pointer; width: 100%; }
        .picker-btn:hover { border-color: #7c3aed; color: #7c3aed; background: #faf5ff; }

        .edit-folder-row { display: flex; align-items: center; gap: 0.375rem; padding: 0.25rem 0 0.5rem; }
        .edit-folder-input { padding: 0.35rem 0.6rem; border: 1.5px solid #7c3aed; border-radius: 6px; font-size: 0.85rem; outline: none; width: 160px; }

        .version-badge { font-size: 0.68rem; color: #c4b5fd; font-weight: 500; letter-spacing: 0.02em; }
      `}</style>

      <div className="section-docs-page">
        <div className="docs-header">
          <div className="docs-header-left">
            <h1>{section.name} Documents</h1>
            <p>{section.folders.length} folder{section.folders.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {section.folders.length === 0 && !canManage ? (
          <div className="empty-state">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
            <p>No documents in this section.</p>
          </div>
        ) : (
          <>
            {/* Tabs row */}
            <div className="tabs-row">
              {section.folders.map(folder => (
                <div key={folder.id} style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: -2 }}>
                  {editingFolder?.id === folder.id ? (
                    <div className="edit-folder-row">
                      <input
                        className="edit-folder-input"
                        value={editFolderName}
                        onChange={e => setEditFolderName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveFolder(); if (e.key === 'Escape') setEditingFolder(null) }}
                        autoFocus
                      />
                      <button className="btn-sm btn-primary" onClick={handleSaveFolder}>Save</button>
                      <button className="btn-sm btn-secondary" onClick={() => setEditingFolder(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      className={`tab${selectedFolderId === folder.id ? ' active' : ''}`}
                      onClick={() => setSelectedFolderId(folder.id)}
                    >
                      {folder.name}
                      {canManage && selectedFolderId === folder.id && (
                        <>
                          <span
                            className="tab-edit-btn"
                            title="Rename folder"
                            onClick={e => { e.stopPropagation(); setEditingFolder({ id: folder.id, name: folder.name }); setEditFolderName(folder.name) }}
                          >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </span>
                          <span
                            className="tab-delete-btn"
                            title="Delete folder"
                            onClick={e => { e.stopPropagation(); handleDeleteFolder(folder) }}
                          >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              ))}

              {/* Add folder controls */}
              {canManage && (
                showAddFolder ? (
                  <div className="add-folder-form">
                    <input
                      className="add-folder-input"
                      placeholder="Folder name"
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddFolder(); if (e.key === 'Escape') setShowAddFolder(false) }}
                      autoFocus
                    />
                    <button className="btn-sm btn-primary" onClick={handleAddFolder} disabled={addFolderLoading}>
                      {addFolderLoading ? '…' : 'Add'}
                    </button>
                    <button className="btn-sm btn-secondary" onClick={() => setShowAddFolder(false)}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn-sm btn-ghost" style={{ marginBottom: 2 }} onClick={() => setShowAddFolder(true)}>
                    + New Folder
                  </button>
                )
              )}
            </div>

            {selectedFolder && (
              <>
                {canManage && (
                  <div className="table-header-row">
                    <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                      {selectedFolder.documents.length} document{selectedFolder.documents.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      className="btn-sm btn-primary"
                      onClick={() => openAddDoc(selectedFolder.id)}
                    >
                      + Add Document
                    </button>
                  </div>
                )}

                {selectedFolder.documents.length > 0 ? (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th style={{ width: canManage ? '35%' : '40%' }}>Name</th>
                          <th style={{ width: canManage ? '30%' : '40%' }}>Description</th>
                          {canManage && <th style={{ width: '15%' }}>Permissions</th>}
                          <th style={{ width: canManage ? '20%' : '20%' }}>Actions</th>
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
                            canManage={canManage}
                            permBadge={permBadgeText(doc.id)}
                            onShareCopied={() => showToast('Link copied to clipboard')}
                            onEdit={() => { setEditDocModal(doc); setEditDocTitle(doc.title); setEditDocDescription(doc.description ?? '') }}
                            onReplace={() => openReplaceDoc(doc)}
                            onDelete={() => handleDeleteDoc(doc)}
                            onPermissions={() => setPermModal(doc)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p>No documents in this folder.{canManage ? ' Click "+ Add Document" to add one.' : ''}</p>
                  </div>
                )}
              </>
            )}

            {!selectedFolder && section.folders.length > 0 && (
              <div className="empty-state"><p>Select a folder above.</p></div>
            )}

            {section.folders.length === 0 && canManage && (
              <div className="empty-state">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                <p>No folders yet. Create one with &ldquo;+ New Folder&rdquo; above.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toastMsg && <div className="toast">{toastMsg}</div>}

      {/* Add Document Modal */}
      {addDocModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setAddDocModal(null) }}>
          <div className="modal">
            <div className="modal-header">
              <h3>Add Document</h3>
              <button className="modal-close" onClick={() => setAddDocModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="source-tabs">
                <button className={`source-tab${docSource === 'drive' ? ' active' : ''}`} onClick={() => setDocSource('drive')}>Google Drive Link</button>
                <button className={`source-tab${docSource === 'upload' ? ' active' : ''}`} onClick={() => setDocSource('upload')}>Upload File</button>
              </div>

              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" placeholder="Document title" value={docTitle} onChange={e => setDocTitle(e.target.value)} />
              </div>

              {docSource === 'drive' ? (
                <>
                  {gapiReady && gisReady ? (
                    <button className="picker-btn" onClick={() => openDrivePicker(addDocModal.folderId)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zm-1-15v4H7l5 5 5-5h-4V7h-2z" /></svg>
                      Browse Google Drive…
                    </button>
                  ) : null}
                  <div className="form-group">
                    <label className="form-label">Drive URL *</label>
                    <input className="form-input" placeholder="https://docs.google.com/…" value={docDriveUrl} onChange={e => setDocDriveUrl(e.target.value)} />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label className="form-label">File * (max 50 MB)</label>
                  <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => setDocFile(e.target.files?.[0] ?? null)} />
                  <button className="picker-btn" onClick={() => fileInputRef.current?.click()}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    {docFile ? docFile.name : 'Choose file…'}
                  </button>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea className="form-textarea" placeholder="Brief description…" value={docDescription} onChange={e => setDocDescription(e.target.value)} />
              </div>

              {addDocError && <p className="error-msg">{addDocError}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-sm btn-secondary" onClick={() => setAddDocModal(null)}>Cancel</button>
              <button className="btn-sm btn-primary" onClick={handleSaveDoc} disabled={addDocLoading}>
                {addDocLoading ? 'Saving…' : 'Add Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Document Modal */}
      {editDocModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditDocModal(null) }}>
          <div className="modal">
            <div className="modal-header">
              <h3>Edit Document</h3>
              <button className="modal-close" onClick={() => setEditDocModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" value={editDocTitle} onChange={e => setEditDocTitle(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={editDocDescription} onChange={e => setEditDocDescription(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-sm btn-secondary" onClick={() => setEditDocModal(null)}>Cancel</button>
              <button className="btn-sm btn-primary" onClick={handleSaveEditDoc} disabled={editDocLoading}>
                {editDocLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace Document Modal */}
      {replaceDocModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setReplaceDocModal(null) }}>
          <div className="modal">
            <div className="modal-header">
              <h3>Replace Document</h3>
              <button className="modal-close" onClick={() => setReplaceDocModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
                Replacing <strong style={{ color: '#111' }}>{replaceDocModal.title}</strong> will increment its version number. The existing file or link will be overwritten.
              </p>
              <div className="source-tabs">
                <button className={`source-tab${replaceDocSource === 'drive' ? ' active' : ''}`} onClick={() => setReplaceDocSource('drive')}>Google Drive Link</button>
                <button className={`source-tab${replaceDocSource === 'upload' ? ' active' : ''}`} onClick={() => setReplaceDocSource('upload')}>Upload File</button>
              </div>

              {replaceDocSource === 'drive' ? (
                <div className="form-group">
                  <label className="form-label">New Drive URL *</label>
                  <input className="form-input" placeholder="https://docs.google.com/…" value={replaceDocDriveUrl} onChange={e => setReplaceDocDriveUrl(e.target.value)} />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">New File * (max 50 MB)</label>
                  <input ref={replaceFileInputRef} type="file" style={{ display: 'none' }} onChange={e => setReplaceDocFile(e.target.files?.[0] ?? null)} />
                  <button className="picker-btn" onClick={() => replaceFileInputRef.current?.click()}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    {replaceDocFile ? replaceDocFile.name : 'Choose file…'}
                  </button>
                </div>
              )}

              {replaceDocError && <p className="error-msg">{replaceDocError}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-sm btn-secondary" onClick={() => setReplaceDocModal(null)}>Cancel</button>
              <button className="btn-sm btn-primary" onClick={handleReplaceDoc} disabled={replaceDocLoading}>
                {replaceDocLoading ? 'Replacing…' : 'Replace'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Modal */}
      {permModal && (
        <PermissionModal
          doc={permModal}
          onClose={() => setPermModal(null)}
          onSaved={reload}
        />
      )}
    </>
  )
}

function DocumentRow({
  doc,
  sectionSlug,
  folderId,
  isHighlighted = false,
  canManage,
  permBadge,
  onShareCopied,
  onEdit,
  onReplace,
  onDelete,
  onPermissions,
}: {
  doc: DriveDocument
  sectionSlug: string
  folderId: string
  isHighlighted?: boolean
  canManage: boolean
  permBadge: string | null
  onShareCopied: () => void
  onEdit: () => void
  onReplace: () => void
  onDelete: () => void
  onPermissions: () => void
}) {
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

  function handleShare() {
    const shareUrl = `${window.location.origin}/documents/${sectionSlug}?folder=${folderId}&doc=${doc.id}`
    navigator.clipboard.writeText(shareUrl).then(onShareCopied)
  }

  const isUploaded = !!doc.storage_path

  return (
    <tr className={isHighlighted ? 'highlighted' : ''}>
      <td>
        <div className="doc-name">
          {isUploaded ? (
            <svg className="doc-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
          ) : (
            <svg className="doc-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
              {doc.title}
              {(doc.version ?? 1) > 1 && <span className="version-badge">v{doc.version}</span>}
            </div>
            {canManage && permBadge !== null && (
              <div className="perm-badge">{permBadge}</div>
            )}
            {canManage && permBadge === null && (
              <div className="perm-badge open">Open to all</div>
            )}
          </div>
        </div>
      </td>
      <td className="doc-description">{doc.description || '—'}</td>
      {canManage && (
        <td>
          <div className="actions">
            <button className="action-btn manage-btn" onClick={onPermissions} title="Manage permissions">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </button>
            <button className="action-btn manage-btn" onClick={onReplace} title="Replace document">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button className="action-btn manage-btn" onClick={onEdit} title="Edit document">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button className="action-btn danger-btn" onClick={onDelete} title="Delete document">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </td>
      )}
      <td>
        <div className="actions">
          <button className="action-btn share-btn" onClick={handleShare} title="Copy share link">Share</button>
          <button className="action-btn open-btn" onClick={handleOpen} disabled={fetching}>
            {fetching ? '…' : 'Open'}
          </button>
        </div>
      </td>
    </tr>
  )
}
