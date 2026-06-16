'use client'

import { useEffect, useState } from 'react'

type BrandDataCompany = {
  employees: number | null
  foundedYear: number | null
  industries: { name: string; slug: string }[] | null
  location: { city: string | null; state: string | null; country: string | null } | null
  kind: string | null
}

export type BrandDataLocal = {
  id: string
  domain: string
  brandfetch_id: string | null
  name: string | null
  description: string | null
  long_description: string | null
  logo_url: string | null
  icon_url: string | null
  colors: { hex: string; type: string; brightness: number }[] | null
  links: { name: string; url: string }[] | null
  company: BrandDataCompany | null
  fetched_at: string
}

export type TagOption = { id: string; name: string; color: string }

export type CustomerDetail = {
  id: string
  name: string
  client_status: 'Prospective' | 'Active' | 'Former' | null
  phone: string | null
  website: string | null
  linkedin: string | null
  email_domains: string | null
  billing_address1: string | null
  billing_address2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_zip: string | null
  billing_country: string | null
  shipping_address1: string | null
  shipping_address2: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_zip: string | null
  shipping_country: string | null
  description: string | null
  tags: TagOption[]
  artwork_notes: string | null
  notes: string | null
  general_logo_color: string | null
  formal_pms_colors: string | null
  assigned_to: string | null
  created_by: string
  created_at: string
  updated_at: string
  logo_url: string | null
  brand_data_id: string | null
  brand_data: BrandDataLocal | null
  commissioned_client: string | null
  tax_exempt: boolean
  stores: { id: string; store_id: string; store_name: string; status: string; is_active: boolean }[]
  contacts: { id: string; first_name: string; last_name: string; title: string | null; email: string | null; phone: string | null; department: string | null }[]
  opportunities: { id: string; name: string; value: number | null; status: string; pipeline_stage: string | null; forecast_close_date: string | null }[]
  files: { id: string; label: string; url: string; created_at: string }[]
  assigned_user: { id: string; display_name: string; email: string } | null
  created_by_user: { id: string; display_name: string; email: string } | null
}

export function useCustomer(id: string | null | undefined) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState<boolean>(!!id && id !== 'new')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || id === 'new') {
      setLoading(false)
      setCustomer(null)
      return
    }

    setLoading(true)
    setError(null)

    fetch(`/api/marketing/customers/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setCustomer(data)
        }
      })
      .catch(() => setError('Failed to load customer'))
      .finally(() => setLoading(false))
  }, [id])

  return { customer, loading, error, setCustomer }
}
