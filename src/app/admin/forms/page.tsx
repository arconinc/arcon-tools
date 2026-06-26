'use client'

import { useState, useEffect } from 'react'
import { CrmForm, FormCategory } from '@/types'
import { formatFileSize } from '@/lib/forms-utils'
import { ConfirmButton } from '@/components/ui/ConfirmButton'

const CATEGORIES: { value: FormCategory; label: string; icon: string }[] = [
  { value: 'vendor', label: 'Vendor Forms', icon: '🏢' },
  { value: 'customer', label: 'Customer Forms', icon: '👥' },
  { value: 'general', label: 'General Forms', icon: '📄' },
]

interface AddFormState {
  name: string
  category: FormCategory
  description: string
  states: string
  loading: boolean
}

export default function FormsAdminPage() {
  const [forms, setForms] = useState<CrmForm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<FormCategory>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStates, setEditStates] = useState('')
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [addForm, setAddForm] = useState<AddFormState>({
    name: '',
    category: 'vendor',
    description: '',
    states: '',
    loading: false,
  })

  useEffect(() => {
    loadForms()
  }, [])

  async function loadForms() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/forms')
      if (!res.ok) throw new Error('Failed to load forms')
      const { forms } = await res.json()
      setForms(forms)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forms')
    } finally {
      setLoading(false)
    }
  }

  async function saveForm(formId: string) {
    if (!editName.trim()) return
    try {
      const res = await fetch('/api/admin/forms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formId,
          name: editName.trim(),
          description: editDescription.trim() || null,
          states_covered: editStates.split(',').map(s => s.toUpperCase().trim()).filter(Boolean),
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setEditingId(null)
      await loadForms()
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to save'}`)
    }
  }

  async function deleteForm(formId: string) {
    try {
      const res = await fetch('/api/admin/forms', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: formId }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      await loadForms()
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to delete'}`)
    }
  }

  async function handleFileUpload(formId: string, file: File) {
    try {
      setUploadingId(formId)
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/admin/forms/${formId}/upload`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      await loadForms()
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Upload failed'}`)
    } finally {
      setUploadingId(null)
    }
  }

  async function generatePublicLink(formId: string) {
    try {
      const res = await fetch(`/api/admin/forms/${formId}/public-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' }),
      })
      if (!res.ok) throw new Error('Failed to generate link')
      const { public_url } = await res.json()
      alert(`Public link:\n\n${public_url}\n\nClick OK to copy to clipboard`)
      navigator.clipboard.writeText(public_url)
      await loadForms()
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to generate link'}`)
    }
  }

  async function createForm() {
    if (!addForm.name.trim()) return
    setAddForm(prev => ({ ...prev, loading: true }))
    try {
      const res = await fetch('/api/admin/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name.trim(),
          category: addForm.category,
          description: addForm.description.trim() || null,
          states_covered: addForm.states.split(',').map(s => s.toUpperCase().trim()).filter(Boolean),
          file_url: 'https://via.placeholder.com/150',
        }),
      })
      if (!res.ok) throw new Error('Failed to create form')
      setAddForm({ name: '', category: 'vendor', description: '', states: '', loading: false })
      await loadForms()
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to create form'}`)
      setAddForm(prev => ({ ...prev, loading: false }))
    }
  }

  const groupedForms = CATEGORIES.reduce((acc, cat) => {
    acc[cat.value] = forms.filter(f => f.category === cat.value && f.is_active)
    return acc
  }, {} as Record<FormCategory, CrmForm[]>)

  return (
    <>
      <style>{`
        .fa-page { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
        .fa-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.75rem; }
        .fa-header h1 { font-size: 1.6rem; font-weight: 700; color: #111; margin: 0; }

        .fa-category { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 1.25rem; overflow: hidden; }
        .fa-category-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.9rem 1.25rem; background: #fafafa; border-bottom: 1px solid #e5e7eb; }
        .fa-category-title { font-weight: 600; font-size: 1rem; color: #111; flex: 1; }
        .fa-category-body { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }

        .fa-form { border: 1px solid #f3f4f6; border-radius: 8px; overflow: hidden; }
        .fa-form-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.875rem; background: #f9fafb; }
        .fa-form-title { font-size: 0.875rem; font-weight: 600; color: #374151; flex: 1; }
        .fa-form-meta { font-size: 0.75rem; color: #9ca3af; margin: 0 0.5rem; }

        .fa-form-content { padding: 0.75rem 0.875rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .fa-form-states { font-size: 0.8rem; color: #6b7280; }
        .fa-form-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }

        .fa-btn { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.8rem; font-weight: 500; cursor: pointer; border: none; transition: background 0.15s; }
        .fa-btn-primary { background: #7c3aed; color: #fff; }
        .fa-btn-primary:hover { background: #6d28d9; }
        .fa-btn-primary:disabled { background: #c4b5fd; cursor: not-allowed; }
        .fa-btn-ghost { background: transparent; color: #6b7280; }
        .fa-btn-ghost:hover { background: #f3f4f6; color: #374151; }
        .fa-btn-danger { background: transparent; color: #ef4444; }
        .fa-btn-danger:hover { background: #fef2f2; }
        .fa-btn-sm { padding: 0.2rem 0.5rem; font-size: 0.75rem; }

        .fa-inline-input { border: 1px solid #d1d5db; border-radius: 6px; padding: 0.3rem 0.6rem; font-size: 0.875rem; outline: none; }
        .fa-inline-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124,58,237,0.15); }

        .fa-add-form { display: flex; gap: 0.5rem; align-items: flex-start; margin-top: 1rem; padding: 1rem; background: #f9fafb; border-radius: 8px; border: 1px dashed #e5e7eb; }
        .fa-add-form-fields { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
        .fa-add-form-row { display: flex; gap: 0.5rem; }
        .fa-add-form-row input { flex: 1; }

        .fa-collapse-btn { background: none; border: none; cursor: pointer; color: #9ca3af; padding: 0; display: flex; }
        .fa-collapse-btn svg { transition: transform 0.2s; }
        .fa-collapse-btn.open svg { transform: rotate(90deg); }

        .fa-file-input { display: none; }
        .fa-file-label { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.8rem; font-weight: 500; cursor: pointer; background: #3b82f6; color: #fff; }
        .fa-file-label:hover { background: #2563eb; }
        .fa-file-label:disabled { background: #93c5fd; cursor: not-allowed; }

        .fa-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; border-radius: 6px; padding: 0.75rem; font-size: 0.875rem; margin-bottom: 1rem; }
      `}</style>

      <div className="fa-page">
        <div className="fa-header">
          <h1>Forms Library</h1>
        </div>

        {error && (
          <div className="fa-error">{error}</div>
        )}

        {loading ? (
          <p style={{ color: '#9ca3af' }}>Loading forms...</p>
        ) : (
          <>
            {CATEGORIES.map(cat => {
              const isCollapsed = collapsedCategories.has(cat.value)
              const categoryForms = groupedForms[cat.value] || []
              return (
                <div key={cat.value} className="fa-category">
                  <div className="fa-category-header">
                    <button
                      className={`fa-collapse-btn${isCollapsed ? '' : ' open'}`}
                      onClick={() => setCollapsedCategories(prev => {
                        const next = new Set(prev)
                        next.has(cat.value) ? next.delete(cat.value) : next.add(cat.value)
                        return next
                      })}
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <span className="fa-category-title">{cat.icon} {cat.label}</span>
                  </div>

                  {!isCollapsed && (
                    <div className="fa-category-body">
                      {categoryForms.length === 0 ? (
                        <p style={{ fontSize: '0.8rem', color: '#d1d5db', margin: 0 }}>No forms yet</p>
                      ) : (
                        categoryForms.map(form => (
                          <FormRow
                            key={form.id}
                            form={form}
                            isEditing={editingId === form.id}
                            editName={editName}
                            editDescription={editDescription}
                            editStates={editStates}
                            onEditStart={() => {
                              setEditingId(form.id)
                              setEditName(form.name)
                              setEditDescription(form.description || '')
                              setEditStates(form.states_covered.join(', '))
                            }}
                            onEditChange={(field, value) => {
                              if (field === 'name') setEditName(value)
                              else if (field === 'description') setEditDescription(value)
                              else if (field === 'states') setEditStates(value)
                            }}
                            onEditSave={() => saveForm(form.id)}
                            onEditCancel={() => setEditingId(null)}
                             onDelete={() => deleteForm(form.id)}
                            onUpload={(file) => handleFileUpload(form.id, file)}
                            onGenerateLink={() => generatePublicLink(form.id)}
                            isUploading={uploadingId === form.id}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add Form */}
            <div className="fa-add-form">
              <div className="fa-add-form-fields">
                <div className="fa-add-form-row">
                  <input
                    className="fa-inline-input"
                    placeholder="Form name"
                    value={addForm.name}
                    onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && addForm.name.trim()) createForm() }}
                  />
                  <select
                    className="fa-inline-input"
                    value={addForm.category}
                    onChange={e => setAddForm(prev => ({ ...prev, category: e.target.value as FormCategory }))}
                  >
                    <option value="vendor">Vendor</option>
                    <option value="customer">Customer</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <input
                  className="fa-inline-input"
                  placeholder="Description (optional)"
                  value={addForm.description}
                  onChange={e => setAddForm(prev => ({ ...prev, description: e.target.value }))}
                />
                <input
                  className="fa-inline-input"
                  placeholder="States (comma-separated, e.g. CA, TX, NY)"
                  value={addForm.states}
                  onChange={e => setAddForm(prev => ({ ...prev, states: e.target.value }))}
                />
              </div>
              <button
                className="fa-btn fa-btn-primary"
                disabled={addForm.loading || !addForm.name.trim()}
                onClick={createForm}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function FormRow({
  form,
  isEditing,
  editName,
  editDescription,
  editStates,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel,
  onDelete,
  onUpload,
  onGenerateLink,
  isUploading,
}: {
  form: CrmForm
  isEditing: boolean
  editName: string
  editDescription: string
  editStates: string
  onEditStart: () => void
  onEditChange: (field: 'name' | 'description' | 'states', value: string) => void
  onEditSave: () => void
  onEditCancel: () => void
  onDelete: () => void
  onUpload: (file: File) => void
  onGenerateLink: () => void
  isUploading: boolean
}) {
  return (
    <div className="fa-form">
      <div className="fa-form-header">
        {isEditing ? (
          <>
            <input
              className="fa-inline-input"
              value={editName}
              onChange={e => onEditChange('name', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel() }}
              autoFocus
            />
            <button className="fa-btn fa-btn-primary fa-btn-sm" onClick={onEditSave}>Save</button>
            <button className="fa-btn fa-btn-ghost fa-btn-sm" onClick={onEditCancel}>Cancel</button>
          </>
        ) : (
          <>
            <span className="fa-form-title">{form.name}</span>
            {form.file_size_bytes && (
              <span className="fa-form-meta">{formatFileSize(form.file_size_bytes)}</span>
            )}
            <ConfirmButton
              idleLabel="×"
              confirmLabel="Remove?"
              onConfirm={onDelete}
              variant="red"
              size="sm"
            />
          </>
        )}
      </div>

      {!isEditing && (
        <div className="fa-form-content">
          {form.description && (
            <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>{form.description}</p>
          )}
          {form.states_covered.length > 0 && (
            <div className="fa-form-states">
              <strong>States:</strong> {form.states_covered.join(', ')}
            </div>
          )}
          <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>
            Updated {new Date(form.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="fa-form-actions">
            {form.file_size_bytes && (
              <a
                href={form.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="fa-btn fa-btn-ghost fa-btn-sm"
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                View
              </a>
            )}
            <label className="fa-file-label">
              {isUploading ? 'Uploading...' : form.file_size_bytes ? '🔄 Replace PDF' : '📤 Upload PDF'}
              <input
                type="file"
                accept=".pdf"
                className="fa-file-input"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) onUpload(file)
                  e.target.value = ''
                }}
                disabled={isUploading}
              />
            </label>
            <button className="fa-btn fa-btn-ghost fa-btn-sm" onClick={onEditStart}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              Edit
            </button>
            {form.category === 'general' && (
              <button className="fa-btn fa-btn-ghost fa-btn-sm" onClick={onGenerateLink}>
                {form.public_token_active ? '🔗' : '🔒'} {form.public_token_active ? 'Public Link' : 'Share'}
              </button>
            )}
          </div>
        </div>
      )}

      {isEditing && (
        <div className="fa-form-content">
          <input
            className="fa-inline-input"
            placeholder="Description"
            value={editDescription}
            onChange={e => onEditChange('description', e.target.value)}
          />
          <input
            className="fa-inline-input"
            placeholder="States (comma-separated)"
            value={editStates}
            onChange={e => onEditChange('states', e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
