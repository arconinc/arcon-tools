'use client'

import { useState } from 'react'
import { CrmForm } from '@/types'
import { formatFileSize, getFormRecommendationMessage } from '@/lib/forms-utils'

interface TaxFormCardProps {
  form: CrmForm
  onDownload?: () => void
  onSendToVendor?: () => void
  onSendToCustomer?: () => void
  showRecommendation?: boolean
  state?: string | null
  allForms?: CrmForm[]
}

export function TaxFormCard({
  form,
  onDownload,
  onSendToVendor,
  onSendToCustomer,
  showRecommendation = false,
  state,
  allForms = []
}: TaxFormCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDownload = async () => {
    if (onDownload) {
      setIsLoading(true)
      try {
        // Log the delivery
        await fetch(`/api/admin/forms/${form.id}/delivery-log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            delivery_method: 'download'
          })
        }).catch(() => {
          // Log failures silently
        })

        onDownload()

        // Open the file
        window.open(form.file_url, '_blank')
      } finally {
        setIsLoading(false)
      }
    }
  }

  const recommendationMessage = showRecommendation && state
    ? getFormRecommendationMessage(state, allForms)
    : null

  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <div className="mb-3">
        <h3 className="font-bold text-lg">{form.name}</h3>
        {form.description && (
          <p className="text-sm text-gray-600">{form.description}</p>
        )}
      </div>

      {recommendationMessage && (
        <div className="mb-3 rounded bg-blue-50 p-2 text-sm text-blue-800 border border-blue-200">
          {recommendationMessage}
        </div>
      )}

      <div className="mb-3 space-y-1 text-sm">
        {form.states_covered && form.states_covered.length > 0 && (
          <p className="text-gray-600">
            <strong>States:</strong> {form.states_covered.join(', ')}
          </p>
        )}
        {form.file_size_bytes && (
          <p className="text-gray-600">
            <strong>Size:</strong> {formatFileSize(form.file_size_bytes)}
          </p>
        )}
        <p className="text-gray-500 text-xs">
          Updated {new Date(form.updated_at).toLocaleDateString()}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleDownload}
          disabled={isLoading}
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Downloading...' : '📥 Download'}
        </button>

        {onSendToVendor && (
          <button
            onClick={onSendToVendor}
            className="rounded bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700"
          >
            📧 Send to Vendor
          </button>
        )}

        {onSendToCustomer && (
          <button
            onClick={onSendToCustomer}
            className="rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
          >
            📧 Send to Customer
          </button>
        )}
      </div>
    </div>
  )
}
