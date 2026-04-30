'use client'

import { useState, useEffect } from 'react'
import { CrmForm } from '@/types'
import { recommendTaxForms, getCustomerFormsByState } from '@/lib/forms-utils'
import { TaxFormCard } from './TaxFormCard'

interface FormRecommenderProps {
  state?: string | null
  type: 'vendor' | 'customer'
  vendorId?: string
  customerId?: string
  onFormSent?: (formId: string) => void
}

export function FormRecommender({
  state,
  type,
  vendorId,
  customerId,
  onFormSent
}: FormRecommenderProps) {
  const [forms, setForms] = useState<CrmForm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchForms()
  }, [])

  const fetchForms = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/forms')
      if (!res.ok) throw new Error('Failed to fetch forms')
      const { forms } = await res.json()
      setForms(forms)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forms')
    } finally {
      setLoading(false)
    }
  }

  const handleSendForm = async (formId: string) => {
    try {
      const res = await fetch(`/api/admin/forms/${formId}/delivery-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId || null,
          customer_id: customerId || null,
          delivery_method: 'email'
        })
      })

      if (!res.ok) throw new Error('Failed to send form')

      onFormSent?.(formId)
      alert('Form delivery logged')
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to send form'}`)
    }
  }

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading forms...</div>
  }

  if (error) {
    return <div className="text-red-600 text-sm">{error}</div>
  }

  const recommendedForms = type === 'vendor'
    ? recommendTaxForms(state, forms)
    : getCustomerFormsByState(state, forms)

  if (recommendedForms.length === 0) {
    return (
      <div className="text-gray-500 text-sm italic">
        {state
          ? `No ${type} forms found for ${state}`
          : `Select a state to see available ${type} forms`}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {recommendedForms.map(form => (
        <TaxFormCard
          key={form.id}
          form={form}
          onDownload={() => handleSendForm(form.id)}
          onSendToVendor={type === 'vendor' ? () => handleSendForm(form.id) : undefined}
          onSendToCustomer={type === 'customer' ? () => handleSendForm(form.id) : undefined}
          showRecommendation={type === 'vendor'}
          state={state}
          allForms={forms}
        />
      ))}
    </div>
  )
}
