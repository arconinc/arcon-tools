'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { DataTable, FilterPillGroup, Modal, type DataTableColumn, type FilterPillOption } from '@/components/ui'
import type { AppUser, Group, GroupCapability, GroupMembership } from '@/types'

type TeamStatusFilter = 'active' | 'inactive'

type TeamWithDetails = Group & {
  capabilities: GroupCapability[]
  member_count: number
}

type TeamMember = GroupMembership & {
  user: Pick<AppUser, 'id' | 'display_name' | 'email' | 'avatar_url' | 'profile_image_url' | 'deactivated_at'> | null
}

type MemberOption = Pick<AppUser, 'id' | 'display_name' | 'email' | 'avatar_url' | 'profile_image_url' | 'deactivated_at'>

type TeamForm = {
  key: string
  name: string
  description: string
  color: string
}

const EMPTY_FORM: TeamForm = {
  key: '',
  name: '',
  description: '',
  color: '#6b7280',
}

async function responseErrorMessage(res: Response, fallback: string) {
  try {
    const data = await res.json()
    return data.error ?? fallback
  } catch {
    return fallback
  }
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function isTeam(group: TeamWithDetails) {
  return group.capabilities.some((c) => c.capability === 'assignment_pool')
}

function sortByName<T extends { name: string }>(a: T, b: T) {
  return a.name.localeCompare(b.name)
}

function sortUsersByLastName(a: MemberOption, b: MemberOption) {
  const getSortName = (user: MemberOption) => {
    const nameParts = user.display_name.trim().split(/\s+/).filter(Boolean)
    const lastName = nameParts.at(-1) ?? user.email
    return `${lastName} ${user.display_name} ${user.email}`.toLocaleLowerCase()
  }
  return getSortName(a).localeCompare(getSortName(b))
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<TeamWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<TeamStatusFilter>('active')
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<TeamWithDetails | null>(null)
  const [form, setForm] = useState<TeamForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  const loadTeams = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/groups?include_inactive=true')
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, 'Failed to load teams.'))
      }
      const data = await res.json()
      if (Array.isArray(data)) {
        setTeams(data.filter(isTeam))
      } else {
        setError(data.error ?? 'Failed to load teams.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTeams() }, [loadTeams])

  function openCreateModal() {
    setEditingTeam(null)
    setForm(EMPTY_FORM)
    setMemberOptions([])
    setMemberIds([])
    setFormError(null)
    setMembersError(null)
    setModalOpen(true)
  }

  async function openEditModal(team: TeamWithDetails) {
    setEditingTeam(team)
    setForm({
      key: team.key,
      name: team.name,
      description: team.description ?? '',
      color: team.color,
    })
    setMemberOptions([])
    setMemberIds([])
    setFormError(null)
    setMembersError(null)
    setModalOpen(true)
    setMembersLoading(true)
    try {
      const res = await fetch(`/api/admin/groups/${team.id}/members`)
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, 'Failed to load team members.'))
      }
      const data: { users?: MemberOption[]; members?: TeamMember[] } = await res.json()
      setMemberOptions(Array.isArray(data.users) ? data.users.sort(sortUsersByLastName) : [])
      setMemberIds(Array.isArray(data.members) ? data.members.map((member) => member.user_id) : [])
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : 'Failed to load team members.')
    } finally {
      setMembersLoading(false)
    }
  }

  async function saveTeam(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    setMembersError(null)
    try {
      const payload = {
        key: form.key.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        color: form.color || '#6b7280',
        capabilities: [{ capability: 'assignment_pool', config: {} }],
      }
      const res = await fetch(editingTeam ? `/api/admin/groups/${editingTeam.id}` : '/api/admin/groups', {
        method: editingTeam ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, 'Failed to save team.'))
      }
      const savedTeam: TeamWithDetails = await res.json()

      if (editingTeam) {
        const memberRes = await fetch(`/api/admin/groups/${editingTeam.id}/members`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: memberIds }),
        })
        if (!memberRes.ok) {
          throw new Error(await responseErrorMessage(memberRes, 'Team saved, but members failed to save.'))
        }
      }

      setModalOpen(false)
      setEditingTeam(null)
      setForm(EMPTY_FORM)
      if (editingTeam) {
        await loadTeams()
      } else {
        setTeams((current) => [...current, savedTeam].sort(sortByName))
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save team.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(team: TeamWithDetails) {
    setTogglingId(team.id)
    setRowErrors((current) => ({ ...current, [team.id]: '' }))
    try {
      const res = await fetch(`/api/admin/groups/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !team.is_active }),
      })
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, team.is_active ? 'Failed to archive team.' : 'Failed to reactivate team.'))
      }
      loadTeams()
    } catch (err) {
      setRowErrors((current) => ({
        ...current,
        [team.id]: err instanceof Error ? err.message : team.is_active ? 'Failed to archive team.' : 'Failed to reactivate team.',
      }))
    } finally {
      setTogglingId(null)
    }
  }

  function renderMemberAvatar(user: MemberOption) {
    const imageUrl = user.profile_image_url || user.avatar_url
    if (imageUrl) {
      return <img src={imageUrl} alt={user.display_name} referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover" />
    }
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-800">
        {user.display_name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}
      </div>
    )
  }

  const activeTeams = teams.filter((team) => team.is_active).sort(sortByName)
  const inactiveTeams = teams.filter((team) => !team.is_active).sort(sortByName)
  const visibleTeams = statusFilter === 'active' ? activeTeams : inactiveTeams
  const searchTerm = search.trim().toLocaleLowerCase()
  const filteredTeams = searchTerm
    ? visibleTeams.filter((team) => `${team.name} ${team.key} ${team.description ?? ''}`.toLocaleLowerCase().includes(searchTerm))
    : visibleTeams

  const filterOptions: FilterPillOption<TeamStatusFilter>[] = [
    { value: 'active', label: 'Active', color: 'green', count: activeTeams.length },
    { value: 'inactive', label: 'Archived', color: 'slate', count: inactiveTeams.length },
  ]

  const columns: DataTableColumn<TeamWithDetails>[] = [
    {
      key: 'name',
      header: 'Team',
      sortValue: (team) => team.name,
      render: (team) => (
        <div className={team.is_active ? '' : 'opacity-60'}>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
            <p className="text-sm font-semibold leading-tight text-slate-900">{team.name}</p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold leading-none text-slate-600">{team.key}</span>
            {team.is_system && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold leading-none text-amber-700">System</span>}
            {!team.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold leading-none text-slate-600">Archived</span>}
          </div>
        </div>
      ),
      skeletonWidth: '70%',
    },
    {
      key: 'description',
      header: 'Description',
      sortValue: (team) => team.description ?? '',
      render: (team) => <span className="text-xs text-slate-600">{team.description || '—'}</span>,
    },
    {
      key: 'members',
      header: 'Members',
      sortValue: (team) => team.member_count,
      render: (team) => <span className="text-xs font-semibold text-slate-600">{team.member_count}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-[190px]',
      headerClassName: 'text-right',
      render: (team) => {
        const rowError = rowErrors[team.id]
        return (
          <div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <button
                type="button"
                onClick={() => openEditModal(team)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => toggleActive(team)}
                disabled={togglingId === team.id || (team.is_system && team.is_active)}
                className="rounded-lg border border-purple-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
              >
                {togglingId === team.id ? 'Updating…' : team.is_active ? 'Archive' : 'Reactivate'}
              </button>
            </div>
            {rowError && (
              <p className="mt-2 text-right text-xs font-medium text-red-600" role="alert">
                {rowError}
              </p>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="mx-auto max-w-screen-xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teams</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage assignable teams and their membership. Anyone can assign tasks to a team; only admins can create or edit teams.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-lg border border-purple-200 px-3 py-1.5 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-50"
        >
          + Add Team
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!error && (
        <section aria-label="Team directory">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <FilterPillGroup
              options={filterOptions}
              value={statusFilter}
              onChange={setStatusFilter}
              label="Filter teams by status"
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" strokeWidth={2} />
                  <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search teams…"
                  aria-label="Search teams"
                  className="h-[34px] min-w-[220px] rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <p className="text-xs text-slate-500">
                Showing {loading ? '…' : filteredTeams.length} of {loading ? '…' : visibleTeams.length}
              </p>
            </div>
          </div>

          <DataTable
            rows={filteredTeams}
            columns={columns}
            loading={loading}
            emptyMessage={searchTerm ? 'No teams match this search.' : statusFilter === 'active' ? 'No active teams found.' : 'No archived teams found.'}
            getRowKey={(team) => team.id}
            minWidth="820px"
          />
        </section>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTeam ? 'Edit team' : 'Add team'}
      >
        <form onSubmit={saveTeam} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((current) => ({
                  ...current,
                  name: e.target.value,
                  key: editingTeam ? current.key : slugify(e.target.value),
                }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-purple-400 focus:outline-none"
                placeholder="Art"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Key *</label>
              <input
                required
                value={form.key}
                disabled={!!editingTeam?.is_system}
                onChange={(e) => setForm((current) => ({ ...current, key: slugify(e.target.value) }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-purple-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="art"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Color</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((current) => ({ ...current, color: e.target.value }))}
                className="h-[34px] w-full rounded-lg border border-slate-200 bg-white px-2 py-1 focus:border-purple-400 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-500">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-purple-400 focus:outline-none"
                placeholder="What this team works on"
              />
            </div>
          </div>

          {editingTeam && (
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600">Members</p>
              {membersLoading ? (
                <p className="text-xs text-slate-500">Loading members…</p>
              ) : membersError ? (
                <p className="text-xs font-medium text-red-600" role="alert">{membersError}</p>
              ) : (
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-2">
                  {memberOptions.length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-slate-500">No active users available.</p>
                  ) : memberOptions.map((user) => (
                    <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-600 hover:bg-purple-50/60">
                      <input
                        type="checkbox"
                        checked={memberIds.includes(user.id)}
                        onChange={(e) => setMemberIds((current) => e.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))}
                        className="accent-purple-600"
                      />
                      {renderMemberAvatar(user)}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-700">{user.display_name}</span>
                        <span className="block truncate text-slate-500">{user.email}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {formError && <p className="text-xs font-medium text-red-600" role="alert">{formError}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || membersLoading}
              className="rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save team'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
