import { CrmForm } from '@/types'

export const US_STATES: Record<string, string> = {
  AK: 'Alaska', AL: 'Alabama', AR: 'Arkansas', AZ: 'Arizona',
  CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii',
  IA: 'Iowa', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  MA: 'Massachusetts', MD: 'Maryland', ME: 'Maine',
  MI: 'Michigan', MN: 'Minnesota', MO: 'Missouri', MS: 'Mississippi', MT: 'Montana',
  NC: 'North Carolina', ND: 'North Dakota', NE: 'Nebraska',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NV: 'Nevada', NY: 'New York',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VA: 'Virginia', VT: 'Vermont',
  WA: 'Washington', WI: 'Wisconsin', WV: 'West Virginia', WY: 'Wyoming',
}

// State coverage mappings for tax exemption forms
export const MULTIJURISDICTIONAL_STATES = [
  'AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
  'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY'
]

export const STREAMLINE_STATES = [
  'AR', 'GA', 'IA', 'IN', 'KS', 'KY', 'MI', 'MN', 'NC', 'ND', 'NE',
  'NJ', 'NV', 'OH', 'OK', 'RI', 'SD', 'TN', 'UT', 'VT', 'WA', 'WI', 'WY'
]

// Recommend vendor forms based on state
export function recommendTaxForms(state: string | null | undefined, availableForms: CrmForm[]): CrmForm[] {
  if (!state) return []

  const stateUpper = state.toUpperCase().trim()

  // Filter to active vendor forms that cover this state
  const applicableForms = availableForms.filter(f =>
    f.is_active &&
    f.category === 'vendor' &&
    f.states_covered?.includes(stateUpper)
  )

  // Sort: Multijurisdictional first (preferred), then Streamline, then others
  return applicableForms.sort((a, b) => {
    const aIsMulti = a.name.toLowerCase().includes('multijuris')
    const bIsMulti = b.name.toLowerCase().includes('multijuris')

    if (aIsMulti && !bIsMulti) return -1
    if (!aIsMulti && bIsMulti) return 1

    const aIsStreamline = a.name.toLowerCase().includes('streamline')
    const bIsStreamline = b.name.toLowerCase().includes('streamline')

    if (aIsStreamline && !bIsStreamline) return -1
    if (!aIsStreamline && bIsStreamline) return 1

    return 0
  })
}

// Get customer-specific forms for a state
export function getCustomerFormsByState(state: string | null | undefined, availableForms: CrmForm[]): CrmForm[] {
  if (!state) return []

  const stateUpper = state.toUpperCase().trim()

  return availableForms.filter(f =>
    f.is_active &&
    f.category === 'customer' &&
    f.states_covered?.includes(stateUpper)
  )
}

// Get all available general forms (W9, etc.)
export function getGeneralForms(availableForms: CrmForm[]): CrmForm[] {
  return availableForms.filter(f => f.is_active && f.category === 'general')
}

// Generate a secure random token for public links
export function generatePublicToken(): string {
  return `${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`
}

// Format file size for display
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return 'Unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Check if form covers a specific state
export function formCoversState(form: CrmForm, state: string): boolean {
  return form.states_covered?.includes(state.toUpperCase()) || false
}

// Get form recommendation message
export function getFormRecommendationMessage(state: string, forms: CrmForm[]): string {
  const recommended = recommendTaxForms(state, forms)

  if (recommended.length === 0) {
    return `No tax forms found for ${state}. Please contact support.`
  }

  if (recommended.length === 1) {
    return `Use the ${recommended[0].name} for ${state}.`
  }

  const primary = recommended[0].name
  const alternatives = recommended.slice(1).map(f => f.name).join(', ')
  return `Preferred: ${primary}. Alternative: ${alternatives}.`
}

// Group forms by category
export function groupFormsByCategory(forms: CrmForm[]): Record<string, CrmForm[]> {
  return forms.reduce((acc, form) => {
    if (!acc[form.category]) {
      acc[form.category] = []
    }
    acc[form.category].push(form)
    return acc
  }, {} as Record<string, CrmForm[]>)
}
