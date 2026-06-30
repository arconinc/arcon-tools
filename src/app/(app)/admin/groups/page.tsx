'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { DataTable, FilterPillGroup, Modal, type DataTableColumn, type FilterPillOption } from '@/components/ui'
import { GROUP_CAPABILITY_KEYS, GROUP_CAPABILITY_LABELS } from '@/lib/groups/constants'
import type { AppUser, Group, GroupCapability, GroupCapabilityKey, GroupMembership } from '@/types'

type GroupStatusFilter = 'active' | 'inactive'

type GroupWithDetails = Group & {
  capabilities: GroupCapability[]
  member_count: number
}

type GroupMember = GroupMembership & {
  user: Pick<AppUser, 'id' | 'display_name' | 'email' | 'avatar_url' | 'profile_image_url' | 'deactivated_at'> | null
}

type MemberOption = Pick<AppUser, 'id' | 'display_name' | 'email' | 'avatar_url' | 'profile_image_url' | 'deactivated_at'>

type GroupForm = {
  key: string
  name: string
  description: string
  color: string
  capabilities: GroupCapabilityKey[]
  poolKey: string
}

const EMPTY_FORM: GroupForm = {
  key: '',
  name: '',
  description: '',
  color: '#6b7280',
  capabilities: [],
  poolKey: '',
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

function capabilityPayload(group: GroupWithDetails | null, capabilityKeys: GroupCapabilityKey[], poolKey: string) {
  return capabilityKeys.map((capability) => ({
    capability,
    config: capability === 'assignment_pool'
      ? { ...(group?.capabilities.find((item) => item.capability === capability)?.config ?? {}), pool_key: poolKey.trim() || undefined }
      : (group?.capabilities.find((item) => item.capability === capability)?.config ?? {}),
  }))
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

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<GroupWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<GroupStatusFilter>('active')
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<GroupWithDetails | null>(null)
  const [form, setForm] = useState<GroupForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [memberOptions, setMemberOptions] = useState<MemberOption[]>([])
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  const loadGroups = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/groups?include_inactive=true')
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, 'Failed to load groups.'))
      }
      const data = await res.json()
      if (Array.isArray(data)) {
        setGroups(data)
      } else {
        setError(data.error ?? 'Failed to load groups.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])

  function openCreateModal() {
    setEditingGroup(null)
    setForm(EMPTY_FORM)
    setMemberOptions([])
    setMemberIds([])
    setFormError(null)
    setMembersError(null)
    setModalOpen(true)
  }

  async function openEditModal(group: GroupWithDetails) {
    setEditingGroup(group)
    const existingPoolCap = group.capabilities.find((c) => c.capability === 'assignment_pool')
    setForm({
      key: group.key,
      name: group.name,
      description: group.description ?? '',
      color: group.color,
      capabilities: group.capabilities.map((capability) => capability.capability),
      poolKey: (existingPoolCap?.config as Record<string, string> | undefined)?.pool_key ?? '',
    })
    setMemberOptions([])
    setMemberIds([])
    setFormError(null)
    setMembersError(null)
    setModalOpen(true)
    setMembersLoading(true)
    try {
      const res = await fetch(`/api/admin/groups/${group.id}/members`)
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, 'Failed to load group members.'))
      }
      const data: { users?: MemberOption[]; members?: GroupMember[] } = await res.json()
      setMemberOptions(Array.isArray(data.users) ? data.users.sort(sortUsersByLastName) : [])
      setMemberIds(Array.isArray(data.members) ? data.members.map((member) => member.user_id) : [])
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : 'Failed to load group members.')
    } finally {
      setMembersLoading(false)
    }
  }

  async function saveGroup(e: FormEvent) {
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
        capabilities: capabilityPayload(editingGroup, form.capabilities, form.poolKey),
      }
      const res = await fetch(editingGroup ? `/api/admin/groups/${editingGroup.id}` : '/api/admin/groups', {
        method: editingGroup ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, 'Failed to save group.'))
      }
      const savedGroup: GroupWithDetails = await res.json()

      if (editingGroup) {
        const memberRes = await fetch(`/api/admin/groups/${editingGroup.id}/members`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: memberIds }),
        })
        if (!memberRes.ok) {
          throw new Error(await responseErrorMessage(memberRes, 'Group saved, but members failed to save.'))
        }
      }

      setModalOpen(false)
      setEditingGroup(null)
      setForm(EMPTY_FORM)
      if (editingGroup) {
        await loadGroups()
      } else {
        setGroups((current) => [...current, savedGroup].sort(sortByName))
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save group.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(group: GroupWithDetails) {
    setTogglingId(group.id)
    setRowErrors((current) => ({ ...current, [group.id]: '' }))
    try {
      const res = await fetch(`/api/admin/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !group.is_active }),
      })
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, group.is_active ? 'Failed to deactivate group.' : 'Failed to reactivate group.'))
      }
      loadGroups()
    } catch (err) {
      setRowErrors((current) => ({
        ...current,
        [group.id]: err instanceof Error ? err.message : group.is_active ? 'Failed to deactivate group.' : 'Failed to reactivate group.',
      }))
    } finally {
      setTogglingId(null)
    }
  }

  function renderCapabilityBadges(group: GroupWithDetails) {
    if (group.capabilities.length === 0) return <span className="text-xs text-slate-400">—</span>
    return group.capabilities.map((capability) => (
      <span key={capability.id} className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold leading-none text-purple-700">
        {GROUP_CAPABILITY_LABELS[capability.capability] ?? capability.capability}
      </span>
    ))
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

  const activeGroups = groups.filter((group) => group.is_active).sort(sortByName)
  const inactiveGroups = groups.filter((group) => !group.is_active).sort(sortByName)
  const visibleGroups = statusFilter === 'active' ? activeGroups : inactiveGroups
  const searchTerm = search.trim().toLocaleLowerCase()
  const filteredGroups = searchTerm
    ? visibleGroups.filter((group) => {
        const capabilities = group.capabilities.map((capability) => GROUP_CAPABILITY_LABELS[capability.capability] ?? capability.capability).join(' ')
        return `${group.name} ${group.key} ${group.description ?? ''} ${capabilities}`.toLocaleLowerCase().includes(searchTerm)
      })
    : visibleGroups

  const filterOptions: FilterPillOption<GroupStatusFilter>[] = [
    { value: 'active', label: 'Active', color: 'green', count: activeGroups.length },
    { value: 'inactive', label: 'Inactive', color: 'slate', count: inactiveGroups.length },
  ]

  const columns: DataTableColumn<GroupWithDetails>[] = [
    {
      key: 'name',
      header: 'Group',
      sortValue: (group) => group.name,
      render: (group) => (
        <div className={group.is_active ? '' : 'opacity-60'}>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
            <p className="text-sm font-semibold leading-tight text-slate-900">{group.name}</p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold leading-none text-slate-600">{group.key}</span>
            {group.is_system && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold leading-none text-amber-700">System</span>}
            {!group.is_active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold leading-none text-slate-600">Inactive</span>}
          </div>
        </div>
      ),
      skeletonWidth: '70%',
    },
    {
      key: 'description',
      header: 'Description',
      sortValue: (group) => group.description ?? '',
      render: (group) => <span className="text-xs text-slate-600">{group.description || '—'}</span>,
    },
    {
      key: 'capabilities',
      header: 'Capabilities',
      sortValue: (group) => group.capabilities.map((capability) => capability.capability).join(', '),
      render: (group) => <div className="flex flex-wrap gap-1">{renderCapabilityBadges(group)}</div>,
    },
    {
      key: 'members',
      header: 'Members',
      sortValue: (group) => group.member_count,
      render: (group) => <span className="text-xs font-semibold text-slate-600">{group.member_count}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-[190px]',
      headerClassName: 'text-right',
      render: (group) => {
        const rowError = rowErrors[group.id]
        return (
          <div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <button
                type="button"
                onClick={() => openEditModal(group)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => toggleActive(group)}
                disabled={togglingId === group.id || (group.is_system && group.is_active)}
                className="rounded-lg border border-purple-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
              >
                {togglingId === group.id ? 'Updating…' : group.is_active ? 'Deactivate' : 'Reactivate'}
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
          <h1 className="text-2xl font-bold text-slate-900">Groups</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage access controls and assignment-pool membership.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-lg border border-purple-200 px-3 py-1.5 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-50"
        >
          + Add Group
        </button>
      </div>

      <div className="mb-5 rounded-lg border border-purple-100 bg-purple-50/50 px-4 py-3 text-xs leading-relaxed text-purple-950/75">
        <strong className="font-semibold text-purple-950">Capabilities</strong> define how groups are used: Access Control or Assignment Pool.
        <span className="mx-2 text-purple-300" aria-hidden="true">•</span>
        <strong className="font-semibold text-purple-950">Members</strong> control who has access or can receive assigned work.
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!error && (
        <section aria-label="Group directory">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <FilterPillGroup
              options={filterOptions}
              value={statusFilter}
              onChange={setStatusFilter}
              label="Filter groups by status"
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
                  placeholder="Search groups…"
                  aria-label="Search groups"
                  className="h-[34px] min-w-[220px] rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <p className="text-xs text-slate-500">
                Showing {loading ? '…' : filteredGroups.length} of {loading ? '…' : visibleGroups.length}
              </p>
            </div>
          </div>

          <DataTable
            rows={filteredGroups}
            columns={columns}
            loading={loading}
            emptyMessage={searchTerm ? 'No groups match this search.' : statusFilter === 'active' ? 'No active groups found.' : 'No inactive groups found.'}
            getRowKey={(group) => group.id}
            minWidth="980px"
          />
        </section>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingGroup ? 'Edit group' : 'Add group'}
      >
        <form onSubmit={saveGroup} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((current) => ({
                  ...current,
                  name: e.target.value,
                  key: editingGroup ? current.key : slugify(e.target.value),
                }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-purple-400 focus:outline-none"
                placeholder="Sales"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Key *</label>
              <input
                required
                value={form.key}
                disabled={!!editingGroup?.is_system}
                onChange={(e) => setForm((current) => ({ ...current, key: slugify(e.target.value) }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-purple-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="sales"
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
                placeholder="What this group controls"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600">Capabilities</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {GROUP_CAPABILITY_KEYS.map((capability) => (
                <label key={capability} className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.capabilities.includes(capability)}
                    onChange={(e) => setForm((current) => ({
                      ...current,
                      capabilities: e.target.checked
                        ? [...current.capabilities, capability]
                        : current.capabilities.filter((item) => item !== capability),
                    }))}
                    className="accent-purple-600"
                  />
                  {GROUP_CAPABILITY_LABELS[capability]}
                </label>
              ))}
            </div>
            {form.capabilities.includes('assignment_pool') && (
              <div className="mt-2">
                <label className="mb-1 block text-xs text-slate-500">Pool Key <span className="text-slate-400">(e.g. <code>sales</code>)</span></label>
                <input
                  type="text"
                  value={form.poolKey}
                  onChange={(e) => setForm((current) => ({ ...current, poolKey: e.target.value }))}
                  placeholder="sales"
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-purple-400 focus:outline-none font-mono"
                />
              </div>
            )}
          </div>

          {editingGroup && (
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
              {saving ? 'Saving…' : 'Save group'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
