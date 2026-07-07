'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Script from 'next/script'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { DocSectionWithTree, DocFolderNode, DriveDocument } from '@/types'
import { PermissionModal } from '@/components/documents/PermissionModal'
import { FolderTreeNode } from '@/components/documents/FolderTreeNode'
import { DocumentNameCell, DocumentActionsCell } from '@/components/documents/DocumentRow'
import { DataTable, type DataTableColumn } from '@/components/ui'

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

// ─── Flatten tree helpers ─────────────────────────────────────────────────────

function flattenFolders(nodes: DocFolderNode[]): DocFolderNode[] {
  const result: DocFolderNode[] = []
  function walk(list: DocFolderNode[]) {
    for (const n of list) {
      result.push(n)
      if (n.children.length > 0) walk(n.children)
    }
  }
  walk(nodes)
  return result
}

function findFolder(nodes: DocFolderNode[], id: string): DocFolderNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findFolder(n.children, id)
    if (found) return found
  }
  return null
}

interface DocSearchResult { doc: DriveDocument; folderId: string; path: string }

function searchFolders(nodes: DocFolderNode[], query: string, parentPath: string[], out: DocSearchResult[]) {
  for (const node of nodes) {
    const path = [...parentPath, node.name]
    for (const doc of node.documents) {
      if (doc.title.toLowerCase().includes(query) || doc.description?.toLowerCase().includes(query)) {
        out.push({ doc, folderId: node.id, path: path.join(' / ') })
      }
    }
    if (node.children.length > 0) searchFolders(node.children, query, path, out)
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SectionDocumentsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const sectionSlug = params.section as string
  const sectionName = SECTION_MAP[sectionSlug]
  const folderParam = searchParams.get('folder')
  const docParam = searchParams.get('doc')

  const [section, setSection] = useState<DocSectionWithTree | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Tree state
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(folderParam ?? null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [highlightedDocId, setHighlightedDocId] = useState<string | null>(docParam)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query || !section) return null
    const out: DocSearchResult[] = []
    searchFolders(section.folders, query, [], out)
    return out
  }, [searchQuery, section])

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  function onResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      setSidebarWidth(Math.min(480, Math.max(160, dragStartWidth.current + delta)))
    }
    function onMouseUp() {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  // Management
  const [canManage, setCanManage] = useState(false)
  const [canCreate, setCanCreate] = useState(false)
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [permSummary, setPermSummary] = useState<Record<string, PermSummaryEntry>>({})
  const [reorderingId, setReorderingId] = useState<string | null>(null)

  // Add folder
  const [addFolderParentId, setAddFolderParentId] = useState<string | null | undefined>(undefined) // undefined = closed, null = top-level
  const [newFolderName, setNewFolderName] = useState('')
  const [addFolderLoading, setAddFolderLoading] = useState(false)

  // Edit folder
  const [editingFolder, setEditingFolder] = useState<DocFolderNode | null>(null)
  const [editFolderName, setEditFolderName] = useState('')

  // Add document modal
  const [addDocModal, setAddDocModal] = useState(false)
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

  // Move document modal
  const [moveDocModal, setMoveDocModal] = useState<DriveDocument | null>(null)
  const [moveDocFolderId, setMoveDocFolderId] = useState('')
  const [moveDocLoading, setMoveDocLoading] = useState(false)
  const [allSectionsForMove, setAllSectionsForMove] = useState<DocSectionWithTree[]>([])

  // Folder right-click context menu
  type CtxMenu = { node: DocFolderNode; x: number; y: number }
  const [folderCtxMenu, setFolderCtxMenu] = useState<CtxMenu | null>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!folderCtxMenu) return
    function close(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent) { if (e.key === 'Escape') setFolderCtxMenu(null); return }
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) setFolderCtxMenu(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [folderCtxMenu])

  function handleFolderRightClick(node: DocFolderNode, x: number, y: number) {
    const menuW = 200, menuH = 280
    setFolderCtxMenu({
      node,
      x: Math.min(x, window.innerWidth - menuW - 8),
      y: Math.min(y, window.innerHeight - menuH - 8),
    })
  }

  // Move folder modal
  const [moveFolderModal, setMoveFolderModal] = useState<DocFolderNode | null>(null)
  const [moveFolderParentId, setMoveFolderParentId] = useState<string>('')
  const [moveFolderLoading, setMoveFolderLoading] = useState(false)

  // Permission modal
  const [permModal, setPermModal] = useState<DriveDocument | null>(null)

  // Confirm modal (replaces native confirm())
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  // Move folder inline error
  const [moveFolderError, setMoveFolderError] = useState<string | null>(null)

  // Google Drive Picker
  const [gapiReady, setGapiReady] = useState(false)
  const [gisReady, setGisReady] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    if (!sectionName) return
    const [docsData, manageData] = await Promise.all([
      fetch('/api/documents').then(r => r.json()),
      fetch(`/api/documents/manage/check?slug=${sectionSlug}`).then(r => r.json()).catch(() => ({ canManage: false, canCreate: false })),
    ])
    const secs: DocSectionWithTree[] = docsData.sections ?? []
    const targetSection = secs.find(s => s.name === sectionName)
    if (!targetSection) { setNotFound(true); setLoading(false); return }

    setSection(targetSection)
    const manage = manageData as { canManage: boolean; canCreate: boolean; sectionId: string | null }
    setCanManage(manage.canManage)
    setCanCreate(manage.canCreate)
    setSectionId(manage.sectionId ?? targetSection.id)

    if (manage.canManage && manage.sectionId) {
      fetch(`/api/documents/manage/permissions-summary?sectionId=${manage.sectionId}`)
        .then(r => r.json())
        .then(d => setPermSummary(d.summary ?? {}))
        .catch(() => {})
    }
    return { secs, targetSection }
  }, [sectionName, sectionSlug])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData().then(result => {
      if (!result) return
      const { targetSection } = result
      // Auto-select first top-level folder if none specified
      if (!folderParam && targetSection.folders.length > 0) {
        const firstId = targetSection.folders[0].id
        setSelectedFolderId(firstId)
        setExpandedIds(new Set([firstId]))
      }
      setLoading(false)
    }).catch(() => { setNotFound(true); setLoading(false) })
  }, [loadData, folderParam])

  async function reload() {
    const result = await loadData()
    if (result?.targetSection) {
      setSection(result.targetSection)
    }
    if (sectionId) {
      fetch(`/api/documents/manage/permissions-summary?sectionId=${sectionId}`)
        .then(r => r.json())
        .then(d => setPermSummary(d.summary ?? {}))
        .catch(() => {})
    }
  }

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  function askConfirm(title: string, message: string, onConfirm: () => void) {
    setConfirmModal({ title, message, onConfirm })
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectFolder(id: string, docId: string | null = null) {
    setSelectedFolderId(id)
    setHighlightedDocId(docId)
    const url = new URL(window.location.href)
    url.searchParams.set('folder', id)
    if (docId) url.searchParams.set('doc', docId)
    else url.searchParams.delete('doc')
    window.history.replaceState(null, '', url.toString())
  }

  function findAncestorIds(nodes: DocFolderNode[], targetId: string, trail: string[] = []): string[] | null {
    for (const n of nodes) {
      if (n.id === targetId) return trail
      const found = findAncestorIds(n.children, targetId, [...trail, n.id])
      if (found) return found
    }
    return null
  }

  function openSearchResult(result: DocSearchResult) {
    if (section) {
      const ancestors = findAncestorIds(section.folders, result.folderId) ?? []
      setExpandedIds(prev => new Set([...prev, ...ancestors, result.folderId]))
    }
    selectFolder(result.folderId, result.doc.id)
    setSearchQuery('')
  }

  function copyFolderLink(node: DocFolderNode) {
    const url = new URL(window.location.href)
    url.searchParams.set('folder', node.id)
    url.searchParams.delete('doc')
    navigator.clipboard.writeText(url.toString()).then(() => showToast('Link copied to clipboard'))
  }

  // ── Folder CRUD ───────────────────────────────────────────────────────────────

  async function handleAddFolder() {
    if (!newFolderName.trim() || !sectionId) return
    setAddFolderLoading(true)
    const body: Record<string, unknown> = {
      section_id: sectionId,
      name: newFolderName.trim(),
      sort_order: 0,
    }
    if (addFolderParentId !== null && addFolderParentId !== undefined) {
      body.parent_folder_id = addFolderParentId
    }
    const res = await fetch('/api/documents/manage/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const { folder } = await res.json()
      setNewFolderName('')
      setAddFolderParentId(undefined)
      await reload()
      setSelectedFolderId(folder.id)
      if (addFolderParentId) {
        setExpandedIds(prev => new Set([...prev, addFolderParentId as string]))
      }
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

  async function handleReorder(nodeId: string, direction: 'up' | 'down') {
    if (!section || reorderingId) return

    function findSiblings(nodes: DocFolderNode[]): DocFolderNode[] | null {
      if (nodes.some(n => n.id === nodeId)) return nodes
      for (const n of nodes) {
        const found = findSiblings(n.children)
        if (found) return found
      }
      return null
    }

    const siblings = findSiblings(section.folders)
    if (!siblings) return
    const idx = siblings.findIndex(n => n.id === nodeId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= siblings.length) return

    const newOrder = [...siblings]
    ;[newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]]

    setReorderingId(nodeId)
    await fetch('/api/documents/manage/folders/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: newOrder.map((f, i) => ({ id: f.id, sort_order: i })) }),
    })
    await reload()
    setReorderingId(null)
  }

  function handleDeleteFolder(node: DocFolderNode) {
    function countDocs(n: DocFolderNode): number {
      return n.documents.length + n.children.reduce((sum, c) => sum + countDocs(c), 0)
    }
    const totalDocs = countDocs(node)
    const hasChildren = node.children.length > 0
    const msg = hasChildren
      ? `Delete "${node.name}" and its ${node.children.length} subfolder${node.children.length !== 1 ? 's' : ''} and ${totalDocs} document${totalDocs !== 1 ? 's' : ''}? This cannot be undone.`
      : `Delete "${node.name}" and ${totalDocs} document${totalDocs !== 1 ? 's' : ''}? This cannot be undone.`
    askConfirm('Delete Folder', msg, async () => {
      setConfirmModal(null)
      await fetch(`/api/documents/manage/folders/${node.id}`, { method: 'DELETE' })
      if (selectedFolderId === node.id) setSelectedFolderId(null)
      await reload()
      showToast('Folder deleted')
    })
  }

  function openMoveFolder(node: DocFolderNode) {
    setMoveFolderModal(node)
    setMoveFolderParentId(node.parent_folder_id ?? '')
    setMoveFolderLoading(false)
  }

  async function handleMoveFolder() {
    if (!moveFolderModal) return
    setMoveFolderLoading(true)
    setMoveFolderError(null)
    const res = await fetch(`/api/documents/manage/folders/${moveFolderModal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_folder_id: moveFolderParentId || null }),
    })
    if (res.ok) {
      setMoveFolderModal(null)
      setMoveFolderError(null)
      await reload()
      showToast('Folder moved')
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Move failed' }))
      setMoveFolderError(error ?? 'Could not move folder.')
    }
    setMoveFolderLoading(false)
  }

  function getDescendantIds(node: DocFolderNode): Set<string> {
    const ids = new Set<string>([node.id])
    function walk(n: DocFolderNode) { n.children.forEach(c => { ids.add(c.id); walk(c) }) }
    walk(node)
    return ids
  }

  function flattenWithDepth(nodes: DocFolderNode[], depth = 0): Array<{ node: DocFolderNode; depth: number }> {
    const result: Array<{ node: DocFolderNode; depth: number }> = []
    for (const n of nodes) {
      result.push({ node: n, depth })
      if (n.children.length > 0) result.push(...flattenWithDepth(n.children, depth + 1))
    }
    return result
  }

  // ── Document CRUD ─────────────────────────────────────────────────────────────

  function openAddDoc() {
    setAddDocModal(true)
    setDocSource('drive')
    setDocTitle('')
    setDocDriveUrl('')
    setDocDescription('')
    setDocFile(null)
    setAddDocError(null)
  }

  function openDrivePicker() {
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
    if (!selectedFolderId || !docTitle.trim()) return
    setAddDocLoading(true)
    setAddDocError(null)

    if (docSource === 'upload') {
      if (!docFile) { setAddDocError('Please select a file.'); setAddDocLoading(false); return }

      // Step 1: get signed upload URL
      const urlRes = await fetch('/api/documents/manage/signed-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: selectedFolderId, filename: docFile.name, content_type: docFile.type }),
      })
      if (!urlRes.ok) {
        const { error } = await urlRes.json().catch(() => ({ error: 'Failed to initiate upload' }))
        setAddDocError(error)
        setAddDocLoading(false)
        return
      }
      const { uploadUrl, storagePath } = await urlRes.json()

      // Step 2: upload directly to Supabase storage
      const putRes = await fetch(uploadUrl, { method: 'PUT', body: docFile, headers: { 'Content-Type': docFile.type } })
      if (!putRes.ok) {
        setAddDocError('File upload failed. Please try again.')
        setAddDocLoading(false)
        return
      }

      // Step 3: create DB record
      const confirmRes = await fetch('/api/documents/manage/upload-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: selectedFolderId, title: docTitle.trim(), description: docDescription.trim() || null, storage_path: storagePath }),
      })
      if (!confirmRes.ok) {
        const { error } = await confirmRes.json().catch(() => ({ error: 'Failed to save document record' }))
        setAddDocError(error)
        setAddDocLoading(false)
        return
      }
    } else {
      if (!docDriveUrl.trim()) { setAddDocError('Drive URL is required.'); setAddDocLoading(false); return }
      const res = await fetch('/api/documents/manage/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: selectedFolderId, title: docTitle.trim(), drive_url: docDriveUrl.trim(), description: docDescription.trim() || null }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Failed to save document' }))
        setAddDocError(error)
        setAddDocLoading(false)
        return
      }
    }

    setAddDocModal(false)
    await reload()
    showToast('Document added')
    setAddDocLoading(false)
  }

  function handleDeleteDoc(doc: DriveDocument) {
    askConfirm('Delete Document', `Delete "${doc.title}"? This cannot be undone.`, async () => {
      setConfirmModal(null)
      await fetch(`/api/documents/manage/items/${doc.id}`, { method: 'DELETE' })
      await reload()
      showToast('Document deleted')
    })
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

      // Step 1: get signed upload URL
      const urlRes = await fetch('/api/documents/manage/signed-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: replaceDocModal.id, filename: replaceDocFile.name, content_type: replaceDocFile.type }),
      })
      if (!urlRes.ok) {
        const { error } = await urlRes.json().catch(() => ({ error: 'Failed to initiate upload' }))
        setReplaceDocError(error)
        setReplaceDocLoading(false)
        return
      }
      const { uploadUrl, storagePath } = await urlRes.json()

      // Step 2: upload directly to Supabase storage
      const putRes = await fetch(uploadUrl, { method: 'PUT', body: replaceDocFile, headers: { 'Content-Type': replaceDocFile.type } })
      if (!putRes.ok) {
        setReplaceDocError('File upload failed. Please try again.')
        setReplaceDocLoading(false)
        return
      }

      // Step 3: update DB record
      const res = await fetch(`/api/documents/manage/items/${replaceDocModal.id}/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: storagePath }),
      })
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

  async function openMoveDoc(doc: DriveDocument) {
    setMoveDocModal(doc)
    setMoveDocFolderId(doc.folder_id)
    setMoveDocLoading(false)
    // Load all sections for folder picker
    const data = await fetch('/api/documents').then(r => r.json())
    setAllSectionsForMove(data.sections ?? [])
  }

  async function handleMoveDoc() {
    if (!moveDocModal || !moveDocFolderId) return
    setMoveDocLoading(true)
    const res = await fetch(`/api/documents/manage/items/${moveDocModal.id}/move`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: moveDocFolderId }),
    })
    if (res.ok) {
      setMoveDocModal(null)
      // If moved out of current folder, stay selected but reload
      await reload()
      showToast('Document moved')
    }
    setMoveDocLoading(false)
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
        <style>{`@keyframes skpulse{0%,100%{opacity:1}50%{opacity:0.45}}.sk{animation:skpulse 1.5s ease-in-out infinite;background:#f3e8ff;border-radius:8px;}`}</style>
        <div style={{ padding: '2rem 1.5rem' }}>
          <div className="sk" style={{ height: '28px', width: '220px', marginBottom: '1.5rem' }} />
          <div className="sk" style={{ height: '400px', borderRadius: '10px' }} />
        </div>
      </>
    )
  }

  if (notFound || !section) {
    return (
      <>
        <style>{`.sp{padding:2rem 1.5rem;}.err{text-align:center;padding:4rem 2rem;color:#9ca3af;} .err h2{font-size:1.25rem;font-weight:600;color:#111;margin:0 0 .5rem;}`}</style>
        <div className="sp"><div className="err"><h2>Section not found</h2><p>The section &ldquo;{sectionSlug}&rdquo; could not be found or you don&apos;t have access to it.</p></div></div>
      </>
    )
  }

  const selectedFolder = selectedFolderId ? findFolder(section.folders, selectedFolderId) : null
  const allFolders = flattenFolders(section.folders)

  return (
    <>
      {canCreate && (
        <>
          <Script src="https://apis.google.com/js/api.js" onLoad={() => { window.gapi.load('picker', () => setGapiReady(true)) }} />
          <Script src="https://accounts.google.com/gsi/client" onLoad={() => setGisReady(true)} />
        </>
      )}

      <style>{`
        .sp { padding: 2rem 1.5rem; }

        .docs-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem; gap: 1rem; }
        .docs-header h1 { font-size: 1.75rem; font-weight: 700; color: #111; margin: 0 0 0.25rem; }
        .docs-header p { color: #6b7280; margin: 0; font-size: 0.9rem; }

        .docs-search { position: relative; margin-bottom: 1.25rem; max-width: 420px; }
        .docs-search input { width: 100%; box-sizing: border-box; padding: 0.6rem 0.875rem 0.6rem 2.25rem; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; outline: none; }
        .docs-search input:focus { border-color: #7c3aed; }
        .docs-search svg { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #9ca3af; width: 16px; height: 16px; }

        .search-results-panel { border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); overflow: hidden; }
        .search-results-header { padding: 0.75rem 1.25rem; border-bottom: 1px solid #f3f4f6; font-size: 0.8rem; color: #9ca3af; }
        .search-result-row { display: flex; align-items: flex-start; gap: 0.625rem; padding: 0.875rem 1.25rem; cursor: pointer; border-bottom: 1px solid #f3f4f6; background: none; width: 100%; text-align: left; border-left: none; border-right: none; border-top: none; }
        .search-result-row:last-child { border-bottom: none; }
        .search-result-row:hover { background: #faf5ff; }
        .search-result-row svg { width: 15px; height: 15px; color: #9ca3af; flex-shrink: 0; margin-top: 2px; }
        .search-result-title { font-size: 0.875rem; font-weight: 600; color: #111; }
        .search-result-desc { font-size: 0.8rem; color: #6b7280; margin-top: 0.15rem; }
        .search-result-path { font-size: 0.75rem; color: #7c3aed; margin-top: 0.3rem; }

        .two-panel { display: flex; gap: 0; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06); min-height: 400px; }

        /* ── Sidebar ── */
        .sidebar { flex-shrink: 0; border-right: none; background: #fafafa; display: flex; flex-direction: column; overflow: hidden; }
        .resize-handle { width: 5px; flex-shrink: 0; background: #e5e7eb; cursor: col-resize; transition: background 0.15s; }
        .resize-handle:hover, .resize-handle:active { background: #7c3aed; }
        .sidebar-header { padding: 0.75rem 0.875rem 0.625rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; }
        .sidebar-label { font-size: 0.7rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; }
        .sidebar-add-btn { background: none; border: none; cursor: pointer; color: #9ca3af; padding: 2px; border-radius: 4px; display: flex; align-items: center; }
        .sidebar-add-btn:hover { color: #7c3aed; background: #ede9fe; }
        .sidebar-tree { flex: 1; overflow-y: auto; padding: 0.375rem 0; }

        .folder-row { display: flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem 0.375rem 0; cursor: pointer; border-radius: 0; transition: background 0.1s; position: relative; min-height: 32px; }
        .folder-row:hover { background: #f3f4f6; }
        .folder-row.selected { background: #ede9fe; }
        .folder-row.selected .folder-name { color: #7c3aed; font-weight: 600; }
        .folder-row.selected .folder-icon { color: #7c3aed; }
        .folder-chevron { width: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #9ca3af; }
        .folder-icon { width: 15px; height: 15px; flex-shrink: 0; color: #f59e0b; }
        .folder-row.selected .folder-icon { color: #7c3aed; }
        .folder-name { font-size: 0.85rem; color: #374151; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .folder-count { font-size: 0.7rem; color: #9ca3af; flex-shrink: 0; background: #f3f4f6; border-radius: 8px; padding: 0.1rem 0.4rem; }
        .folder-row.selected .folder-count { background: #ede9fe; color: #7c3aed; }

        .folder-row.reordering { opacity: 0.6; pointer-events: none; }
        .folder-spinner { animation: docspin 0.7s linear infinite; color: #7c3aed; }
        @keyframes docspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .ctx-menu { position: fixed; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.14); min-width: 190px; z-index: 9999; overflow: hidden; padding: 0.25rem 0; }
        .ctx-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.55rem 0.875rem; font-size: 0.85rem; color: #374151; cursor: pointer; border: none; background: none; width: 100%; text-align: left; }
        .ctx-item:hover { background: #f9fafb; }
        .ctx-item.danger { color: #ef4444; }
        .ctx-item.danger:hover { background: #fef2f2; }
        .ctx-item svg { flex-shrink: 0; color: #9ca3af; }
        .ctx-item.danger svg { color: #fca5a5; }
        .ctx-divider { height: 1px; background: #f3f4f6; margin: 0.25rem 0; }

        .add-folder-inline { padding: 0.5rem 0.75rem; display: flex; flex-direction: column; gap: 0.375rem; border-top: 1px solid #e5e7eb; background: #fafafa; }
        .add-folder-label { font-size: 0.72rem; color: #6b7280; font-weight: 600; }
        .add-folder-input { padding: 0.35rem 0.5rem; border: 1.5px solid #7c3aed; border-radius: 6px; font-size: 0.825rem; outline: none; width: 100%; box-sizing: border-box; }
        .add-folder-btns { display: flex; gap: 0.375rem; }
        .btn-xs { padding: 0.25rem 0.625rem; font-size: 0.775rem; border-radius: 6px; cursor: pointer; border: 1px solid transparent; font-weight: 500; }
        .btn-xs-primary { background: #7c3aed; color: #fff; border-color: #7c3aed; }
        .btn-xs-primary:hover:not(:disabled) { background: #5b21b6; }
        .btn-xs-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-xs-secondary { background: #fff; color: #374151; border-color: #e5e7eb; }
        .btn-xs-secondary:hover { background: #f9fafb; }

        .sidebar-new-root { margin: 0.375rem 0.75rem 0.5rem; }
        .sidebar-new-root-btn { width: 100%; padding: 0.375rem 0.625rem; font-size: 0.8rem; border: 1.5px dashed #d1d5db; border-radius: 8px; background: none; color: #6b7280; cursor: pointer; text-align: left; }
        .sidebar-new-root-btn:hover { border-color: #7c3aed; color: #7c3aed; background: #faf5ff; }

        .sidebar-empty { padding: 1.5rem 0.875rem; font-size: 0.8rem; color: #9ca3af; text-align: center; }

        /* ── Content panel ── */
        .content-panel { flex: 1; min-width: 0; display: flex; flex-direction: column; background: #fff; }
        .content-header { padding: 0.875rem 1.25rem; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 53px; }
        .content-folder-name { font-size: 0.95rem; font-weight: 600; color: #111; }
        .content-doc-count { font-size: 0.8rem; color: #9ca3af; }
        .content-body { flex: 1; overflow-y: auto; }

.doc-link { display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer; text-decoration: none; }
        .doc-link:hover .doc-title { color: #7c3aed; text-decoration: underline; }
        .doc-icon { width: 15px; height: 15px; color: #9ca3af; flex-shrink: 0; margin-top: 2px; }
        .doc-link:hover .doc-icon { color: #7c3aed; }
        .doc-title { font-size: 0.875rem; font-weight: 500; color: #111; line-height: 1.3; }
        .doc-subtitle { font-size: 0.775rem; color: #9ca3af; margin-top: 0.15rem; }
        .version-badge { font-size: 0.68rem; color: #c4b5fd; font-weight: 500; }
        .perm-badge { display: inline-block; font-size: 0.68rem; color: #7c3aed; background: #ede9fe; border-radius: 10px; padding: 0.1rem 0.4rem; margin-top: 0.2rem; }
        .perm-badge.open { color: #15803d; background: #dcfce7; }

        /* ── Actions dropdown ── */
        .actions-cell { position: relative; text-align: right; }
        .actions-menu-btn { padding: 0.35rem 0.625rem; border: 1px solid #e5e7eb; border-radius: 6px; background: #fff; cursor: pointer; font-size: 0.875rem; color: #6b7280; transition: all 0.1s; }
        .actions-menu-btn:hover { background: #f3f4f6; border-color: #d1d5db; color: #374151; }
        .actions-dropdown { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); min-width: 160px; overflow: hidden; }
        .actions-dropdown-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.55rem 0.875rem; font-size: 0.85rem; color: #374151; cursor: pointer; border: none; background: none; width: 100%; text-align: left; transition: background 0.1s; }
        .actions-dropdown-item:hover { background: #f9fafb; }
        .actions-dropdown-item.danger { color: #ef4444; }
        .actions-dropdown-item.danger:hover { background: #fef2f2; }
        .actions-dropdown-divider { height: 1px; background: #f3f4f6; margin: 0.25rem 0; }
        .actions-dropdown-item svg { flex-shrink: 0; color: #9ca3af; }
        .actions-dropdown-item.danger svg { color: #fca5a5; }

        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3.5rem 2rem; color: #9ca3af; text-align: center; flex: 1; gap: 0.5rem; }
        .empty-state svg { color: #e5e7eb; }
        .empty-state p { margin: 0; font-size: 0.875rem; }

        /* ── Buttons ── */
        .btn-sm { padding: 0.4rem 0.875rem; font-size: 0.825rem; border-radius: 8px; cursor: pointer; border: 1px solid transparent; font-weight: 500; }
        .btn-primary { background: #7c3aed; color: #fff; border-color: #7c3aed; }
        .btn-primary:hover:not(:disabled) { background: #5b21b6; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-secondary { background: #fff; color: #374151; border-color: #e5e7eb; }
        .btn-secondary:hover { background: #f9fafb; }

        .toast { position: fixed; bottom: 2rem; right: 2rem; background: #059669; color: #fff; padding: 0.875rem 1.25rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: docslideIn 0.3s ease-out; z-index: 2000; font-size: 0.875rem; }
        @keyframes docslideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal { background: #fff; border-radius: 16px; width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem 1rem; border-bottom: 1px solid #e5e7eb; }
        .modal-header h3 { font-size: 1rem; font-weight: 700; color: #111; margin: 0; }
        .modal-close { background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 1.25rem; padding: 0.25rem; }
        .modal-close:hover { color: #374151; }
        .modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
        .modal-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 1rem 1.5rem; border-top: 1px solid #f3f4f6; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .form-label { font-size: 0.8rem; font-weight: 600; color: #374151; }
        .form-input, .form-textarea, .form-select { padding: 0.5rem 0.75rem; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 0.875rem; outline: none; width: 100%; box-sizing: border-box; font-family: inherit; }
        .form-input:focus, .form-textarea:focus, .form-select:focus { border-color: #7c3aed; }
        .form-textarea { resize: vertical; min-height: 70px; }
        .source-tabs { display: flex; border-bottom: 1px solid #e5e7eb; margin-bottom: 4px; }
        .source-tab { flex: 1; padding: 0.5rem; font-size: 0.85rem; font-weight: 500; text-align: center; cursor: pointer; border: none; background: transparent; color: #6b7280; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.15s; }
        .source-tab.active { color: #7c3aed; font-weight: 700; border-bottom-color: #7c3aed; }
        .error-msg { color: #ef4444; font-size: 0.8rem; }
        .picker-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.875rem; border: 1.5px solid #e5e7eb; border-radius: 8px; background: #fff; font-size: 0.85rem; color: #374151; cursor: pointer; width: 100%; }
        .picker-btn:hover { border-color: #7c3aed; color: #7c3aed; background: #faf5ff; }
      `}</style>

      <div className="sp">
        <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1rem' }}>
          <Link href="/documents" style={{ color: '#7c3aed', textDecoration: 'none', fontWeight: 500 }}>Documents</Link>
          <span style={{ margin: '0 0.375rem' }}>{'/'}</span>
          <span style={{ color: '#374151' }}>{section.name}</span>
        </div>
        <div className="docs-header">
          <div>
            <h1>{section.name} Documents</h1>
            <p>{allFolders.length} folder{allFolders.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="docs-search">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" /></svg>
          <input
            type="text"
            placeholder="Search documents by name or description…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {searchResults !== null ? (
          <div className="search-results-panel">
            <div className="search-results-header">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
            </div>
            {searchResults.length === 0 ? (
              <div className="empty-state">
                <p>No documents match your search.</p>
              </div>
            ) : (
              searchResults.map(r => (
                <button key={r.doc.id} className="search-result-row" onClick={() => openSearchResult(r)}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <div>
                    <div className="search-result-title">{r.doc.title}</div>
                    {r.doc.description && <div className="search-result-desc">{r.doc.description}</div>}
                    <div className="search-result-path">{r.path}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
        <div className="two-panel">
          {/* ── Sidebar ── */}
          <div className="sidebar" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
            <div className="sidebar-header">
              <span className="sidebar-label">Folders</span>
              {canCreate && (
                <button
                  className="sidebar-add-btn"
                  title="New top-level folder"
                  onClick={() => { setAddFolderParentId(null); setNewFolderName('') }}
                >
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                </button>
              )}
            </div>

            <div className="sidebar-tree">
              {section.folders.length === 0 && addFolderParentId === undefined && (
                <div className="sidebar-empty">No folders yet.</div>
              )}
              {section.folders.map((node, idx) => (
                editingFolder?.id === node.id ? (
                  <div key={node.id} className="add-folder-inline" style={{ paddingLeft: '0.875rem' }}>
                    <input
                      className="add-folder-input"
                      value={editFolderName}
                      onChange={e => setEditFolderName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveFolder(); if (e.key === 'Escape') setEditingFolder(null) }}
                      autoFocus
                    />
                    <div className="add-folder-btns">
                      <button className="btn-xs btn-xs-primary" onClick={handleSaveFolder}>Save</button>
                      <button className="btn-xs btn-xs-secondary" onClick={() => setEditingFolder(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <FolderTreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    selectedId={selectedFolderId}
                    expandedIds={expandedIds}
                    reorderingId={reorderingId}
                    onSelect={selectFolder}
                    onToggleExpand={toggleExpand}
                    onRightClick={handleFolderRightClick}
                  />
                )
              ))}
            </div>

            {/* Inline add-folder form */}
            {canCreate && addFolderParentId !== undefined && (
              <div className="add-folder-inline">
                <span className="add-folder-label">
                  {addFolderParentId === null ? 'New top-level folder' : `New subfolder`}
                </span>
                <input
                  className="add-folder-input"
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddFolder(); if (e.key === 'Escape') setAddFolderParentId(undefined) }}
                  autoFocus
                />
                <div className="add-folder-btns">
                  <button className="btn-xs btn-xs-primary" onClick={handleAddFolder} disabled={addFolderLoading}>
                    {addFolderLoading ? '…' : 'Add'}
                  </button>
                  <button className="btn-xs btn-xs-secondary" onClick={() => setAddFolderParentId(undefined)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Resize handle ── */}
          <div className="resize-handle" onMouseDown={onResizeMouseDown} />

          {/* ── Content panel ── */}
          <div className="content-panel">
            <div className="content-header">
              {selectedFolder ? (
                <>
                  <div>
                    <span className="content-folder-name">{selectedFolder.name}</span>
                    <span className="content-doc-count" style={{ marginLeft: '0.5rem' }}>
                      {selectedFolder.documents.length} doc{selectedFolder.documents.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {canCreate && (
                    <button className="btn-sm btn-primary" onClick={openAddDoc}>+ Add Document</button>
                  )}
                </>
              ) : (
                <span className="content-doc-count">Select a folder</span>
              )}
            </div>

            <div className="content-body">
              {!selectedFolder ? (
                <div className="empty-state">
                  <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                  <p>Select a folder to view documents.</p>
                </div>
              ) : (
                <DataTable
                  rows={selectedFolder.documents}
                  columns={[
                    {
                      key: 'name',
                      header: 'Name',
                      sortValue: (doc) => doc.title,
                      render: (doc) => (
                        <DocumentNameCell
                          doc={doc}
                          canManage={canManage}
                          permBadge={permBadgeText(doc.id)}
                          isHighlighted={highlightedDocId === doc.id}
                        />
                      ),
                    },
                    {
                      key: 'actions',
                      header: '',
                      className: 'w-16',
                      skeletonWidth: '40px',
                      render: (doc) => (
                        <DocumentActionsCell
                          doc={doc}
                          canManage={canManage}
                          sectionSlug={sectionSlug}
                          folderId={selectedFolder.id}
                          onEdit={() => { setEditDocModal(doc); setEditDocTitle(doc.title); setEditDocDescription(doc.description ?? '') }}
                          onReplace={() => openReplaceDoc(doc)}
                          onDelete={() => handleDeleteDoc(doc)}
                          onPermissions={() => setPermModal(doc)}
                          onMove={() => openMoveDoc(doc)}
                          onShareCopied={() => showToast('Link copied to clipboard')}
                        />
                      ),
                    },
                  ]}
                  loading={false}
                  emptyMessage={canCreate ? 'No documents in this folder. Click "+ Add Document" to add one.' : 'No documents in this folder.'}
                  getRowKey={(doc) => doc.id}
                  minWidth="400px"
                />
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {toastMsg && <div className="toast">{toastMsg}</div>}

      {/* Add Document Modal */}
      {addDocModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setAddDocModal(false) }}>
          <div className="modal">
            <div className="modal-header">
              <h3>Add Document</h3>
              <button className="modal-close" onClick={() => setAddDocModal(false)}>✕</button>
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
                  {gapiReady && gisReady && (
                    <button className="picker-btn" onClick={openDrivePicker}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10zm-1-15v4H7l5 5 5-5h-4V7h-2z" /></svg>
                      Browse Google Drive…
                    </button>
                  )}
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
              <button className="btn-sm btn-secondary" onClick={() => setAddDocModal(false)}>Cancel</button>
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
                Replacing <strong style={{ color: '#111' }}>{replaceDocModal.title}</strong> will increment its version number.
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

      {/* Move Document Modal */}
      {moveDocModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setMoveDocModal(null) }}>
          <div className="modal">
            <div className="modal-header">
              <h3>Move Document</h3>
              <button className="modal-close" onClick={() => setMoveDocModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
                Move <strong style={{ color: '#111' }}>{moveDocModal.title}</strong> to a different folder.
              </p>
              <div className="form-group">
                <label className="form-label">Destination Folder</label>
                <select className="form-select" value={moveDocFolderId} onChange={e => setMoveDocFolderId(e.target.value)}>
                  {allSectionsForMove.map(sec => {
                    const flat = flattenFolders(sec.folders)
                    if (flat.length === 0) return null
                    return (
                      <optgroup key={sec.id} label={sec.name}>
                        {flat.map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-sm btn-secondary" onClick={() => setMoveDocModal(null)}>Cancel</button>
              <button
                className="btn-sm btn-primary"
                onClick={handleMoveDoc}
                disabled={moveDocLoading || moveDocFolderId === moveDocModal.folder_id}
              >
                {moveDocLoading ? 'Moving…' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder right-click context menu */}
      {folderCtxMenu && section && (() => {
        const ctxNode = folderCtxMenu.node
        // Compute sibling position live from current section state — never stale
        function findSiblings(nodes: DocFolderNode[]): DocFolderNode[] | null {
          if (nodes.some(n => n.id === ctxNode.id)) return nodes
          for (const n of nodes) {
            const found = findSiblings(n.children)
            if (found) return found
          }
          return null
        }
        const siblings = findSiblings(section.folders) ?? []
        const sibIdx = siblings.findIndex(n => n.id === ctxNode.id)
        const canMoveUp = sibIdx > 0
        const canMoveDown = sibIdx < siblings.length - 1
        return (
          <div ref={ctxMenuRef} className="ctx-menu" style={{ left: folderCtxMenu.x, top: folderCtxMenu.y }}>
            <button className="ctx-item" onClick={() => { copyFolderLink(folderCtxMenu.node); setFolderCtxMenu(null) }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              Copy link
            </button>
            {canManage && (
              <>
                <div className="ctx-divider" />
                {canMoveUp && (
                  <button className="ctx-item" onClick={() => { handleReorder(folderCtxMenu.node.id, 'up'); setFolderCtxMenu(null) }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                    Move up
                  </button>
                )}
                {canMoveDown && (
                  <button className="ctx-item" onClick={() => { handleReorder(folderCtxMenu.node.id, 'down'); setFolderCtxMenu(null) }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                    Move down
                  </button>
                )}
                <button className="ctx-item" onClick={() => { openMoveFolder(folderCtxMenu.node); setFolderCtxMenu(null) }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  Move to folder…
                </button>
                <button className="ctx-item" onClick={() => { setEditingFolder(folderCtxMenu.node); setEditFolderName(folderCtxMenu.node.name); setFolderCtxMenu(null) }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Rename
                </button>
                <div className="ctx-divider" />
                <button className="ctx-item danger" onClick={() => { handleDeleteFolder(folderCtxMenu.node); setFolderCtxMenu(null) }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete
                </button>
              </>
            )}
            {canCreate && (
              <>
                <div className="ctx-divider" />
                <button className="ctx-item" onClick={() => { setAddFolderParentId(folderCtxMenu.node.id); setNewFolderName(''); setExpandedIds(prev => new Set([...prev, folderCtxMenu.node.id])); setFolderCtxMenu(null) }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  New subfolder
                </button>
              </>
            )}
          </div>
        )
      })()}

      {/* Move Folder Modal */}
      {moveFolderModal && section && (() => {
        const excluded = getDescendantIds(moveFolderModal)
        const options = flattenWithDepth(section.folders).filter(({ node }) => !excluded.has(node.id))
        const currentParentId = moveFolderModal.parent_folder_id ?? ''
        const isDirty = moveFolderParentId !== currentParentId
        return (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setMoveFolderModal(null) }}>
            <div className="modal">
              <div className="modal-header">
                <h3>Move Folder</h3>
                <button className="modal-close" onClick={() => setMoveFolderModal(null)}>✕</button>
              </div>
              <div className="modal-body">
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
                  Move <strong style={{ color: '#111' }}>{moveFolderModal.name}</strong> to a different location.
                </p>
                <div className="form-group">
                  <label className="form-label">Destination</label>
                  <select className="form-select" value={moveFolderParentId} onChange={e => setMoveFolderParentId(e.target.value)}>
                    <option value="">(Top level)</option>
                    {options.map(({ node, depth }) => (
                      <option key={node.id} value={node.id}>
                        {'  '.repeat(depth)}{depth > 0 ? '↳ ' : ''}{node.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {moveFolderError && <p className="error-msg" style={{ margin: 0 }}>{moveFolderError}</p>}
              <div className="modal-footer">
                <button className="btn-sm btn-secondary" onClick={() => { setMoveFolderModal(null); setMoveFolderError(null) }}>Cancel</button>
                <button
                  className="btn-sm btn-primary"
                  onClick={handleMoveFolder}
                  disabled={moveFolderLoading || !isDirty}
                >
                  {moveFolderLoading ? 'Moving…' : 'Move'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setConfirmModal(null) }}>
          <div className="modal">
            <div className="modal-header">
              <h3>{confirmModal.title}</h3>
              <button className="modal-close" aria-label="Close" onClick={() => setConfirmModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151' }}>{confirmModal.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-sm btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button
                className="btn-sm"
                style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}
                onClick={() => confirmModal.onConfirm()}
              >
                Delete
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
