'use client'

import { useState, useEffect } from 'react'
import type { DriveDocument, DocumentAccessSummary } from '@/types'

interface Role {
  id: string
  name: string
  label: string
  color: string
}

interface ModalUser {
  id: string
  display_name: string
  email: string
  avatar_url: string | null
  department: string[] | null
}

interface PermissionModalProps {
  doc: DriveDocument
  onClose: () => void
  onSaved: () => void
}

export function PermissionModal({ doc, onClose, onSaved }: PermissionModalProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [owner, setOwner] = useState<{ id: string; display_name: string; email: string } | null>(null)
  const [roleGrants, setRoleGrants] = useState<string[]>([])
  const [userGrants, setUserGrants] = useState<ModalUser[]>([])
  const [allRoles, setAllRoles] = useState<Role[]>([])
  const [allUsers, setAllUsers] = useState<ModalUser[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [accessSummaryOpen, setAccessSummaryOpen] = useState(false)
  const [accessSummary, setAccessSummary] = useState<DocumentAccessSummary | null>(null)
  const [accessSummaryLoading, setAccessSummaryLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const [permsRes, rolesRes, usersRes] = await Promise.all([
        fetch(`/api/documents/manage/items/${doc.id}/permissions`),
        fetch('/api/documents/manage/roles'),
        fetch('/api/documents/manage/users'),
      ])
      if (!permsRes.ok) { onClose(); return }
      const { owner: o, permissions, canEdit: ce } = await permsRes.json()
      const { roles } = await rolesRes.json()
      const { users } = await usersRes.json()

      setOwner(o)
      setCanEdit(ce)
      setRoleGrants(permissions.filter((p: { role_id: string | null }) => p.role_id).map((p: { role_id: string }) => p.role_id))
      setUserGrants(permissions.filter((p: { user_id: string | null; user: ModalUser | null }) => p.user_id && p.user).map((p: { user: ModalUser }) => p.user))
      setAllRoles(roles ?? [])
      setAllUsers(users ?? [])
      setLoading(false)
    }
    load()
  }, [doc.id, onClose])

  async function loadAccessSummary() {
    setAccessSummaryLoading(true)
    const res = await fetch(`/api/documents/manage/items/${doc.id}/access-summary`)
    if (res.ok) setAccessSummary(await res.json())
    setAccessSummaryLoading(false)
  }

  async function save() {
    setSaving(true)
    await fetch(`/api/documents/manage/items/${doc.id}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_grants: roleGrants, user_grants: userGrants.map(u => u.id) }),
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  function toggleRole(roleId: string) {
    setRoleGrants(prev => prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId])
  }

  function addUser(user: ModalUser) {
    if (!userGrants.find(u => u.id === user.id)) {
      setUserGrants(prev => [...prev, user])
    }
    setUserSearch('')
  }

  function removeUser(userId: string) {
    setUserGrants(prev => prev.filter(u => u.id !== userId))
  }

  const isOpenToAll = roleGrants.length === 0 && userGrants.length === 0
  const filteredUsers = userSearch.length > 1
    ? allUsers.filter(u =>
        !userGrants.find(g => g.id === u.id) &&
        (u.display_name.toLowerCase().includes(userSearch.toLowerCase()) ||
         u.email.toLowerCase().includes(userSearch.toLowerCase()))
      ).slice(0, 8)
    : []

  return (
    <>
      <style>{`
        .perm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .perm-modal { background: #fff; border-radius: 14px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .perm-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem 1rem; border-bottom: 1px solid #e5e7eb; }
        .perm-header h3 { font-size: 1rem; font-weight: 700; color: #111; margin: 0; }
        .perm-close { background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 1.25rem; line-height: 1; padding: 0.25rem; }
        .perm-close:hover { color: #374151; }
        .perm-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
        .perm-section-label { font-size: 0.8rem; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
        .perm-owner-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: #374151; }
        .perm-owner-avatar { width: 28px; height: 28px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 600; color: #6b7280; flex-shrink: 0; }
        .access-banner { padding: 0.625rem 0.875rem; border-radius: 8px; font-size: 0.8rem; font-weight: 500; }
        .access-banner.open { background: #d1fae5; color: #065f46; }
        .access-banner.restricted { background: #fef3c7; color: #92400e; }
        .roles-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
        .role-chip { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; border: 1.5px solid #e5e7eb; border-radius: 8px; cursor: pointer; transition: all 0.15s; user-select: none; }
        .role-chip.checked { border-color: #7c3aed; background: #f5f3ff; }
        .role-chip:not(.checked):hover { border-color: #d8b4fe; background: #faf5ff; }
        .role-chip input { display: none; }
        .role-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .role-label { font-size: 0.85rem; font-weight: 500; color: #374151; }
        .role-chip.checked .role-label { color: #7c3aed; }
        .user-search-wrap { position: relative; }
        .user-search-input { width: 100%; padding: 0.5rem 0.75rem; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 0.875rem; outline: none; box-sizing: border-box; }
        .user-search-input:focus { border-color: #7c3aed; }
        .user-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); z-index: 100; max-height: 200px; overflow-y: auto; }
        .user-dropdown-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; cursor: pointer; font-size: 0.875rem; }
        .user-dropdown-item:hover { background: #f5f3ff; }
        .user-chips { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.5rem; }
        .user-chip { display: flex; align-items: center; gap: 0.375rem; padding: 0.25rem 0.5rem 0.25rem 0.625rem; background: #ede9fe; border-radius: 20px; font-size: 0.8rem; color: #5b21b6; font-weight: 500; }
        .user-chip-remove { background: none; border: none; cursor: pointer; color: #7c3aed; font-size: 1rem; line-height: 1; padding: 0; display: flex; align-items: center; }
        .user-chip-remove:hover { color: #4c1d95; }
        .access-summary-toggle { background: none; border: none; cursor: pointer; font-size: 0.8rem; color: #7c3aed; font-weight: 500; padding: 0; display: flex; align-items: center; gap: 0.25rem; }
        .access-summary-toggle:hover { color: #6d28d9; }
        .access-summary-list { margin-top: 0.625rem; display: flex; flex-direction: column; gap: 0.375rem; }
        .access-summary-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: #374151; }
        .access-via { font-size: 0.7rem; color: #9ca3af; margin-left: auto; }
        .perm-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 1rem 1.5rem; border-top: 1px solid #f3f4f6; }
        .btn-cancel { padding: 0.5rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; color: #374151; font-size: 0.875rem; cursor: pointer; }
        .btn-cancel:hover { background: #f9fafb; }
        .btn-save { padding: 0.5rem 1.25rem; border: none; border-radius: 8px; background: #7c3aed; color: #fff; font-size: 0.875rem; cursor: pointer; font-weight: 500; }
        .btn-save:hover:not(:disabled) { background: #6d28d9; }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div className="perm-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="perm-modal">
          <div className="perm-header">
            <h3>Permissions — {doc.title}</h3>
            <button className="perm-close" onClick={onClose}>✕</button>
          </div>

          {loading ? (
            <div className="perm-body" style={{ alignItems: 'center', padding: '2rem' }}>
              <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Loading…</span>
            </div>
          ) : (
            <>
              <div className="perm-body">
                {/* Owner */}
                {owner && (
                  <div>
                    <div className="perm-section-label">Owner</div>
                    <div className="perm-owner-row">
                      <div className="perm-owner-avatar">{owner.display_name.charAt(0).toUpperCase()}</div>
                      <span>{owner.display_name}</span>
                      <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{owner.email}</span>
                    </div>
                  </div>
                )}

                {/* Access banner */}
                <div className={`access-banner ${isOpenToAll ? 'open' : 'restricted'}`}>
                  {isOpenToAll
                    ? 'Open to all — any authenticated user can access this document'
                    : 'Restricted — only users with matching roles or individual grants can access'}
                </div>

                {/* Role grants */}
                <div>
                  <div className="perm-section-label">Role access</div>
                  <div className="roles-grid">
                    {allRoles.map(role => (
                      <label
                        key={role.id}
                        className={`role-chip${roleGrants.includes(role.id) ? ' checked' : ''}`}
                        style={{ opacity: canEdit ? 1 : 0.6, cursor: canEdit ? 'pointer' : 'default' }}
                      >
                        <input
                          type="checkbox"
                          checked={roleGrants.includes(role.id)}
                          onChange={() => canEdit && toggleRole(role.id)}
                          disabled={!canEdit}
                        />
                        <span className="role-dot" style={{ background: role.color || '#9ca3af' }} />
                        <span className="role-label">{role.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Individual user grants */}
                <div>
                  <div className="perm-section-label">Individual access</div>
                  {canEdit && (
                    <div className="user-search-wrap">
                      <input
                        className="user-search-input"
                        type="text"
                        placeholder="Search users by name or email…"
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                      />
                      {filteredUsers.length > 0 && (
                        <div className="user-dropdown">
                          {filteredUsers.map(u => (
                            <div key={u.id} className="user-dropdown-item" onClick={() => addUser(u)}>
                              <div className="perm-owner-avatar" style={{ width: 24, height: 24, fontSize: '0.65rem' }}>
                                {u.display_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 500 }}>{u.display_name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{u.email}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {userGrants.length > 0 && (
                    <div className="user-chips">
                      {userGrants.map(u => (
                        <div key={u.id} className="user-chip">
                          {u.display_name}
                          {canEdit && (
                            <button className="user-chip-remove" onClick={() => removeUser(u.id)} title="Remove">✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {userGrants.length === 0 && !canEdit && (
                    <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: 0 }}>No individual grants.</p>
                  )}
                </div>

                {/* Who has access */}
                <div>
                  <button
                    className="access-summary-toggle"
                    onClick={() => {
                      if (!accessSummaryOpen && !accessSummary) loadAccessSummary()
                      setAccessSummaryOpen(o => !o)
                    }}
                  >
                    {accessSummaryOpen ? '▾' : '▸'} Who has access
                  </button>
                  {accessSummaryOpen && (
                    <div className="access-summary-list">
                      {accessSummaryLoading ? (
                        <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Loading…</span>
                      ) : accessSummary ? (
                        accessSummary.resolved_users.length === 0 ? (
                          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>No users resolved.</span>
                        ) : (
                          accessSummary.resolved_users.map(u => (
                            <div key={u.id} className="access-summary-row">
                              <div className="perm-owner-avatar" style={{ width: 22, height: 22, fontSize: '0.6rem' }}>
                                {u.display_name.charAt(0).toUpperCase()}
                              </div>
                              <span>{u.display_name}</span>
                              <span className="access-via">{u.via}</span>
                            </div>
                          ))
                        )
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              <div className="perm-footer">
                <button className="btn-cancel" onClick={onClose}>Cancel</button>
                {canEdit && (
                  <button className="btn-save" onClick={save} disabled={saving}>
                    {saving ? 'Saving…' : 'Save permissions'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
