'use client'

import { useState } from 'react'
import { formatPhoneInput } from '@/lib/phone'
import type { CustomerDetail } from './useCustomer'

type SetCustomer = React.Dispatch<React.SetStateAction<CustomerDetail | null>>

export function useCustomerEdit(customer: CustomerDetail | null, setCustomer: SetCustomer) {
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<CustomerDetail>>({})
  const [saving, setSaving] = useState(false)
  const [aturianError, setAturianError] = useState<string | null>(null)

  function startEdit() {
    if (!customer) return
    setEditForm({ ...customer })
    setAturianError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setEditForm({})
    setAturianError(null)
  }

  function handleEditChange(field: string, value: string) {
    const formatted = field === 'phone' ? formatPhoneInput(value) : value
    setEditForm((prev) => ({ ...prev, [field]: formatted || null }))
  }

  function handleEditBoolChange(field: string, value: boolean) {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  async function saveEdit() {
    if (!customer) return
    setSaving(true)
    try {
      const res = await fetch(`/api/marketing/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Save failed'); return }
      setCustomer((prev) => prev ? { ...prev, ...data } : prev)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return {
    editing,
    editForm,
    saving,
    aturianError,
    setAturianError,
    startEdit,
    cancelEdit,
    handleEditChange,
    handleEditBoolChange,
    saveEdit,
  }
}
