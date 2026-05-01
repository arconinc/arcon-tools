'use client'

import { useState, useEffect, useRef } from 'react'
import {
  DEPARTMENTS,
  DEPARTMENT_CATEGORIES,
  encodeTaskAssignmentValue,
  getTaskCategoryLabel,
  parseTaskAssignmentValue,
} from '@/lib/task-constants'
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

type MenuField = 'assignee' | 'assignment' | 'priority' | 'due_date'

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
  const [assignmentSearch, setAssignmentSearch] = useState('')
  const [localAssignment, setLocalAssignment] = useState<{
    department: CrmTaskDepartment | null
    category: string | null
  }>({
    department: (task.department as CrmTaskDepartment | null) ?? null,
    category: task.category,
  })
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

  useEffect(() => {
    setLocalAssignment({
      department: (task.department as CrmTaskDepartment | null) ?? null,
      category: task.category,
    })
  }, [task.id, task.department, task.category])

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

  const handleAssignmentChange = async (value: string) => {
    const assignment = parseTaskAssignmentValue(value)
    setLocalAssignment(assignment)
    await handleFieldChange('assignment', assignment)
  }

  const activeAssignmentValue = encodeTaskAssignmentValue(localAssignment.department, localAssignment.category)
  const assignmentQuery = assignmentSearch.trim().toLowerCase()

  const filteredUsers = assigneeSearch.trim()
    ? allUsers.filter((u) => u.display_name.toLowerCase().includes(assigneeSearch.toLowerCase()))
    : allUsers

  const filteredDepartments = DEPARTMENTS.map((department) => {
    const categories = DEPARTMENT_CATEGORIES[department].filter((category) =>
      !assignmentQuery ||
      category.toLowerCase().includes(assignmentQuery) ||
      getTaskCategoryLabel(category).toLowerCase().includes(assignmentQuery)
    )
    const departmentMatches = !assignmentQuery || department.toLowerCase().includes(assignmentQuery)
    return { department, categories: departmentMatches ? DEPARTMENT_CATEGORIES[department] : categories, departmentMatches }
  }).filter(({ categories, departmentMatches }) => departmentMatches || categories.length > 0)

  // Adjust position to stay within viewport
  const adjustedPosition = { ...position }
  if (typeof window !== 'undefined') {
    const panelWidth = 420
    const padding = 10
    if (position.x + panelWidth + padding > window.innerWidth) {
      adjustedPosition.x = Math.max(padding, position.x - panelWidth - 10)
    }
  }

  const menuItems: Array<{ id: MenuField; label: string }> = [
    { id: 'assignee', label: 'Assign to' },
    { id: 'assignment', label: '' +
            'Category' },
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

          {selectedField === 'assignment' && (
            <div>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
                <input type="text" value={assignmentSearch} onChange={(e) => setAssignmentSearch(e.target.value)}
                  placeholder="Search…" autoFocus
                  style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, outline: 'none' }} />
              </div>
              <button onClick={() => handleAssignmentChange('')}
                disabled={loading === 'assignment'}
                style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: 'none', background: !activeAssignmentValue ? '#f5f3ff' : 'transparent', textAlign: 'left', cursor: 'pointer', color: !activeAssignmentValue ? '#6b1e98' : '#999', fontWeight: !activeAssignmentValue ? 600 : 400 }}>
                None
              </button>
              {filteredDepartments.map(({ department, categories }) => (
                <div key={department}>
                  <button
                    onClick={() => handleAssignmentChange(`department:${department}`)}
                    disabled={loading === 'assignment'}
                    style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: 'none', background: activeAssignmentValue === `department:${department}` ? '#f5f3ff' : 'transparent', textAlign: 'left', cursor: 'pointer', color: activeAssignmentValue === `department:${department}` ? '#6b1e98' : '#222', fontWeight: 700 }}
                    onMouseEnter={(e) => { if (activeAssignmentValue !== `department:${department}`) (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff' }}
                    onMouseLeave={(e) => { if (activeAssignmentValue !== `department:${department}`) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    {department}
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => handleAssignmentChange(`category:${category}`)}
                      disabled={loading === 'assignment'}
                      style={{ width: '100%', padding: '7px 12px 7px 28px', fontSize: 12, border: 'none', background: activeAssignmentValue === `category:${category}` ? '#f5f3ff' : 'transparent', textAlign: 'left', cursor: 'pointer', color: activeAssignmentValue === `category:${category}` ? '#6b1e98' : '#222', fontWeight: activeAssignmentValue === `category:${category}` ? 600 : 400 }}
                      onMouseEnter={(e) => { if (activeAssignmentValue !== `category:${category}`) (e.currentTarget as HTMLButtonElement).style.background = '#f5f3ff' }}
                      onMouseLeave={(e) => { if (activeAssignmentValue !== `category:${category}`) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                    >
                      {getTaskCategoryLabel(category)}
                    </button>
                  ))}
                </div>
              ))}
              {filteredDepartments.length === 0 && (
                <div style={{ padding: '12px', fontSize: 12, color: '#aaa', textAlign: 'center' }}>No departments or categories</div>
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
