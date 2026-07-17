'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export type CallLogEntityType = 'customer' | 'vendor' | 'opportunity'
export type CallLogActivityType = 'call' | 'email' | 'meeting' | 'text' | 'other'

export type CallLogContact = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  title: string | null
}

export type CallLogEntry = {
  id: string
  customer_id: string | null
  vendor_id: string | null
  opportunity_id: string | null
  contact_id: string | null
  contact_name_snapshot: string | null
  contact_email_snapshot: string | null
  activity_type: CallLogActivityType
  occurred_at: string
  duration_minutes: number | null
  outcome: string | null
  notes: string | null
  next_steps: string | null
  logged_by: string
  created_at: string
  updated_at: string
  logged_by_user: { id: string; display_name: string; email: string } | null
  contact: CallLogContact | null
}

export type CreateCallLogInput = {
  contact_id?: string | null
  activity_type: CallLogActivityType
  occurred_at: string
  duration_minutes?: number | null
  outcome?: string | null
  notes?: string | null
  next_steps?: string | null
}

function parentParam(entityType: CallLogEntityType) {
  if (entityType === 'customer') return 'customer_id'
  if (entityType === 'vendor') return 'vendor_id'
  return 'opportunity_id'
}

export function useCallLogs(entityType: CallLogEntityType, entityId: string | null | undefined) {
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([])
  const [loading, setLoading] = useState<boolean>(!!entityId)
  const [error, setError] = useState<string | null>(null)

  const url = useMemo(() => {
    if (!entityId) return null
    return `/api/marketing/call-logs?${parentParam(entityType)}=${encodeURIComponent(entityId)}`
  }, [entityType, entityId])

  const refetch = useCallback(async () => {
    if (!url) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load call logs')
      setCallLogs(data.call_logs ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load call logs')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const createCallLog = useCallback(async (input: CreateCallLogInput) => {
    if (!entityId) throw new Error('Missing record id')
    const parent = { [parentParam(entityType)]: entityId }
    const res = await fetch('/api/marketing/call-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...parent, ...input }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to log conversation')
    setCallLogs((prev) => [data, ...prev].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)))
    return data as CallLogEntry
  }, [entityId, entityType])

  return { callLogs, loading, error, refetch, createCallLog }
}

