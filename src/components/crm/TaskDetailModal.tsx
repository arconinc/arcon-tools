'use client'

import { useEffect, useState } from 'react'
import { TaskFormModal, type TaskFormTask } from '@/components/crm/CreateTaskModal'

export function TaskDetailModal({
  taskId,
  onClose,
  onTaskUpdated,
}: {
  taskId: string | null
  onClose: () => void
  onTaskUpdated?: (task: TaskFormTask) => void
}) {
  const [task, setTask] = useState<TaskFormTask | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId) return
    let active = true
    setTask(null)
    setLoading(true)
    setError(null)
    fetch(`/api/marketing/tasks/${taskId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return
        if (data.error) {
          setError(data.error)
          return
        }
        setTask(data)
      })
      .catch(() => {
        if (active) setError('Failed to load task')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [taskId])

  if (!taskId) return null

  if (loading || error || !task) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
        <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-xl font-bold text-slate-900">Edit Task</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6">
            {loading && (
              <div className="space-y-4">
                <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-36 animate-pulse rounded-lg bg-slate-100" />
              </div>
            )}
            {!loading && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error ?? 'Task not found'}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <TaskFormModal
      open={true}
      mode="edit"
      task={task}
      onClose={onClose}
      onSaved={(savedTask) => {
        setTask(savedTask)
        onTaskUpdated?.(savedTask)
      }}
    />
  )
}
