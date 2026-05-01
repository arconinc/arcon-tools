'use client'

import { useState, useEffect, useRef } from 'react'
import { DEPARTMENTS, DEPARTMENT_CATEGORIES } from '@/lib/task-constants'
import type { CrmTaskDepartment } from '@/types'

export type Priority = 'low' | 'medium' | 'high'

type TaskItem = {
  id: string
  title: string
  department: string | null
  category: string | null
  priority: Priority
  assigned_to: string | null
  assigned_user_name: string | null
  due_date: string | null
}

type UserOption = {
  id: string
  display_name: string
  team: string | null
  department: string | null
  avatar_url: string | null
  profile_image_url: string | null
}

type MenuField = 'assignee' | 'department' | 'category' | 'priority' | 'due_date'

interface TaskQuickEditPanelProps {
  task: TaskItem
  position: { x: number; y: number }
  onClose: () => void
  onUpdate: (field: string, value: unknown) => Promise<void>
  allUsers: UserOption[]
}

export function TaskQuickEditPanel({ task, position, onClose, onUpdate, allUsers }: TaskQuickEditPanelProps) {
  const [selectedField, setSelectedField] = useState<MenuField | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [localDept, setLocalDept] = useState<CrmTaskDepartment | ''>(task.department as CrmTaskDepartment | '' ?? '')
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const handleFieldChange = async (field: string, value: unknown) => {
    setLoading(field)
    try {
      await onUpdate(field, value)
      setSelectedField(null)
    } catch (error) {
      console.error(`Failed to update ${field}:`, error)
    } finally {
      setLoading(null)
    }
  }

  // When department changes in the panel, update local state and save
  const handleDeptChange = async (dept: CrmTaskDepartment | '') => {
    setLocalDept(dept)
    await handleFieldChange('department', dept || null)
  }

  const activeDept = localDept || (task.department as CrmTaskDepartment | null) || ''
  const availableCategories = activeDept
    ? DEPARTMENT_CATEGORIES[activeDept as CrmTaskDepartment] ?? []
    : Object.values(DEPARTMENT_CATEGORIES).flat()

  const filteredUsers = assigneeSearch.trim()
    ? allUsers.filter((u) => u.display_name.toLowerCase().includes(assigneeSearch.toLowerCase()))
    : allUsers

  const filteredCategories = categorySearch.trim()
    ? availableCategories.filter((c) => c.toLowerCase().includes(categorySearch.toLowerCase()))
    : availableCategories

  // Adjust position to stay within viewport
  let adjustedPosition = { ...position }
  if (typeof window !== 'undefined') {
    const panelWidth = 420
    const padding = 10
    if (position.x + panelWidth + padding > window.innerWidth) {
      adjustedPosition.x = Math.max(padding, position.x - panelWidth - 10)
    }
  }

  const menuItems: Array<{ id: MenuField; label: string }> = [
    { id: 'assignee', label: 'Assign to' },
    { id: 'department', label: 'Department' },
    { id: 'category', label: 'Category' },
    { id: 'priority', label: 'Priority' },
    { id: 'due_date', label: 'Due Date' },
  ]

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        zIndex: 10000,
        background: '#fff',
        border: '1px solid #d1d5db',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        display: 'flex',
      }}
    >
      {/* Left menu */}
      <div style={{ width: 160, borderRight: '1px solid #e5e7eb', background: '#fafafa' }}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedField(selectedField === item.id ? null : item.id)}
            onMouseEnter={() => setSelectedField(item.id)}
            style={{
              width: '100%', padding: '11px 12px', fontSize: 13,
              border: 'none',
              background: selectedField === item.id ? '#f5f3ff' : 'transparent',
              color: selectedField === item.id ? '#6b1e98' : '#222',
              fontWeight: selectedField === item.id ? 600 : 400,
              textAlign: 'left', cursor: 'pointer',
              transition: 'background 0.12s, color 0.12s',
              borderRadius: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span>{item.label}</span>
            {selectedField === item.id && <span style={{ fontSize: 10, marginLeft: 4 }}>▶</span>}
          </button>
        ))}
      </div>

      {/* Right submenu */}
      {selectedField && (
        <div style={{ width: 250, padding: '8px 0', maxHeight: 340, overflowY: 'auto' }}>

          {selectedField === 'assignee' && (
            <div>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
                <input type="text" value={assigneeSearch} onChange={(e) => setAssigneeSearch(e.target.value)}
                  placeholder="Search…" autoFocus
                  style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, outline: 'none' }} />
              </div>
              {filteredUsers.map((user) => (
                <button key={user.id} onClick={() => handleFieldChange('assigned_to', user.id)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#222', fontWeight: task.assigned_to === user.id ? 600 : 400 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                  {user.display_name}
                  {user.department && <span style={{ fontSize: 10, color: '#aaa', marginLeft: 6 }}>{user.department}</span>}
                </button>
              ))}
            </div>
          )}

          {selectedField === 'department' && (
            <div>
              <button
                onClick={() => handleDeptChange('')}
                style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: 'none', background: !activeDept ? '#f5f3ff' : 'transparent', textAlign: 'left', cursor: 'pointer', color: !activeDept ? '#6b1e98' : '#222', fontWeight: !activeDept ? 600 : 400 }}>
                None
              </button>
              {DEPARTMENTS.map((d) => (
                <button key={d} onClick={() => handleDeptChange(d)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: 'none', background: activeDept === d ? '#f5f3ff' : 'transparent', textAlign: 'left', cursor: 'pointer', color: activeDept === d ? '#6b1e98' : '#222', fontWeight: activeDept === d ? 600 : 400 }}
                  onMouseEnter={(e) => { if (activeDept !== d) (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff' }}
                  onMouseLeave={(e) => { if (activeDept !== d) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                  {d}
                  {DEPARTMENT_CATEGORIES[d].length > 0 && (
                    <span style={{ fontSize: 10, color: '#aaa', marginLeft: 6 }}>{DEPARTMENT_CATEGORIES[d].length} cats</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {selectedField === 'category' && (
            <div>
              {activeDept && (
                <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {activeDept}
                </div>
              )}
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
                <input type="text" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Search…" autoFocus
                  style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, outline: 'none' }} />
              </div>
              <button onClick={() => handleFieldChange('category', null)}
                style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: 'none', background: !task.category ? '#f5f3ff' : 'transparent', textAlign: 'left', cursor: 'pointer', color: '#999' }}>
                None
              </button>
              {filteredCategories.map((cat) => (
                <button key={cat} onClick={() => handleFieldChange('category', cat)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#222', fontWeight: task.category === cat ? 600 : 400 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
                  {cat}
                </button>
              ))}
              {filteredCategories.length === 0 && (
                <div style={{ padding: '12px', fontSize: 12, color: '#aaa', textAlign: 'center' }}>No categories</div>
              )}
            </div>
          )}

          {selectedField === 'priority' && (
            <div style={{ padding: '8px' }}>
              {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                <button key={p} onClick={() => handleFieldChange('priority', p)} disabled={loading === 'priority'}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid', borderRadius: 4, marginBottom: 6, cursor: 'pointer', textTransform: 'capitalize', fontWeight: 600, background: task.priority === p ? '#6b1e98' : '#f5f3ff', color: task.priority === p ? '#fff' : '#6b1e98', borderColor: task.priority === p ? '#6b1e98' : '#d1d5db' }}>
                  {p}
                </button>
              ))}
            </div>
          )}

          {selectedField === 'due_date' && (
            <div style={{ padding: '8px 12px' }}>
              <input type="date" value={task.due_date || ''} onChange={(e) => handleFieldChange('due_date', e.target.value || null)}
                disabled={loading === 'due_date'} autoFocus
                style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, outline: 'none' }} />
              {task.due_date && (
                <button onClick={() => handleFieldChange('due_date', null)}
                  style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: 'none', background: '#f5f3ff', color: '#6b1e98', borderRadius: 4, marginTop: 6, cursor: 'pointer', fontWeight: 500 }}>
                  Clear date
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
