'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Rule<V> = { test: (value: V) => boolean; message: string }
export type FieldRules<T> = { [K in keyof T]?: Rule<T[K]>[] }
export type FormErrors<T> = Partial<Record<keyof T, string>>

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Reusable form validation hook.
 *
 * Usage:
 *   const { errors, validate, clearError } = useFormValidation<MyForm>()
 *
 *   // On submit:
 *   if (!validate(formValues, rules)) return
 *
 *   // On field change:
 *   clearError('fieldName')
 */
export function useFormValidation<T extends Record<string, unknown>>() {
  const [errors, setErrors] = useState<FormErrors<T>>({})

  function validate(form: T, rules: FieldRules<T>): boolean {
    const next: FormErrors<T> = {}
    for (const key in rules) {
      const fieldRules = rules[key]
      if (!fieldRules) continue
      for (const rule of fieldRules) {
        if (!rule.test(form[key] as T[typeof key])) {
          next[key] = rule.message
          break
        }
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function clearError(field: keyof T) {
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function resetErrors() {
    setErrors({})
  }

  return { errors, validate, clearError, resetErrors }
}

// ─── Class helpers ────────────────────────────────────────────────────────────

/** Base class string shared by inputs and selects */
const BASE = 'w-full px-2.5 py-1.5 text-sm rounded-lg focus:outline-none focus:ring-2 transition-colors'

/** className for <input> elements */
export function inputCls(error?: string): string {
  return `${BASE} border ${error ? 'border-red-400 focus:ring-red-300' : 'border-slate-200 focus:ring-purple-400'}`
}

/** className for <select> elements (adds bg-white) */
export function selectCls(error?: string): string {
  return `${inputCls(error)} bg-white`
}

// ─── Components ───────────────────────────────────────────────────────────────

/** Renders the red error message beneath a field. Pass errors.fieldName directly. */
export function FieldError({ error }: { error?: string }) {
  if (!error) return null
  return <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>
}
