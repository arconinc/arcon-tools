'use client'

import { useState, useCallback } from 'react'

// ── Shared Types ──────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'waiting_on_approval'
  | 'waiting_on_client_approval'
  | 'need_changes'

export type TaskPriority = 'low' | 'medium' | 'high'

export type TaskAttachment = {
  id: string; task_id: string; url: string
  file_name: string | null; file_size: number | null; mime_type: string | null
  uploaded_by: string; created_at: string
}

export type Attachment = {
  id: string; comment_id: string; label: string; url: string
  file_name: string | null; file_size: number | null; mime_type: string | null
  is_drive_link: boolean; uploaded_by: string; created_at: string
}

export type Comment = {
  id: string; task_id: string; user_id: string; comment: string
  created_at: string; updated_at: string
  attachments: Attachment[]
  user: { display_name: string }
}

export type HistoryEntry = {
  id: string; task_id: string; user_id: string; field_changed: string
  old_value: string | null; new_value: string | null; changed_at: string
  user: { id: string; display_name: string }
}

export type TaskDetail = {
  id: string; title: string; assigned_to: string | null; task_owner: string | null
  department: string | null; category: string | null; priority: TaskPriority; due_date: string | null
  status: TaskStatus; progress: number; description: string | null
  opportunity_id: string | null; customer_id: string | null
  vendor_id: string | null; contact_id: string | null
  created_by: string; created_at: string; updated_at: string
  comments: Comment[]
  history: HistoryEntry[]
  opportunity: { id: string; name: string } | null
  customer: { id: string; name: string } | null
  vendor: { id: string; name: string } | null
  contact: { id: string; first_name: string; last_name: string } | null
  assigned_user: { id: string; display_name: string; email: string } | null
  created_user: { id: string; display_name: string } | null
  delegator_users: { id: string; display_name: string }[]
  attachments: TaskAttachment[]
  linked_spec: { id: string; item_name: string; status: string } | null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTask(id: string) {
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/marketing/tasks/${id}`)
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setTask(data)
    }
  }, [id])

  async function load() {
    setLoading(true)
    try {
      await refetch()
    } finally {
      setLoading(false)
    }
  }

  return { task, setTask, loading, setLoading, error, refetch, load }
}
