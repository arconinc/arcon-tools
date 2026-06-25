'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { PLACES_OFFICES } from '@/lib/google-places'
import type {
  PlacesAutocompleteSuggestion,
  PlacesDetails,
  PlacesOfficeKey,
} from '@/lib/google-places'

type PlacesCompanyAutocompleteProps = {
  value: string
  onChange: (value: string) => void
  onPlaceSelect: (place: PlacesDetails) => void
  inputClassName?: string
  labelClassName?: string
  required?: boolean
}

export function PlacesCompanyAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  inputClassName,
  labelClassName,
  required = false,
}: PlacesCompanyAutocompleteProps) {
  const [office, setOffice] = useState<PlacesOfficeKey>('eagan')
  const [suggestions, setSuggestions] = useState<PlacesAutocompleteSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [selectingPlaceId, setSelectingPlaceId] = useState<string | null>(null)
  const sessionToken = useRef<string>(createSessionToken())
  const trimmedValue = value.trim()

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      input: trimmedValue,
      office,
      sessionToken: sessionToken.current,
    })
    return params.toString()
  }, [office, trimmedValue])

  useEffect(() => {
    if (trimmedValue.length < 3) {
      setSuggestions([])
      setOpen(false)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/marketing/places/autocomplete?${queryParams}`, {
          signal: controller.signal,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Search failed')
        setSuggestions(data.suggestions ?? [])
        setOpen(true)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message)
          setSuggestions([])
          setOpen(false)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 400)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [queryParams, trimmedValue.length])

  async function handleSelect(suggestion: PlacesAutocompleteSuggestion) {
    setSelectingPlaceId(suggestion.placeId)
    setError(null)
    try {
      const params = new URLSearchParams({
        placeId: suggestion.placeId,
        sessionToken: sessionToken.current,
      })
      const res = await fetch(`/api/marketing/places/details?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not load place details')
      onPlaceSelect(data.place)
      setOpen(false)
      setSuggestions([])
      sessionToken.current = createSessionToken()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSelectingPlaceId(null)
    }
  }

  return (
    <div className="relative">
      <div className="flex items-end justify-between gap-3">
        <div className="flex-1 min-w-0">
          <label className={labelClassName}>
            Company Name {required && <span className="text-red-500">*</span>}
          </label>
          <p className="text-xs text-slate-400 italic mb-1">Full Corporate Company Name</p>
        </div>
        <div className="w-44 flex-shrink-0">
          <label className={labelClassName}>Search Near</label>
          <select
            value={office}
            onChange={(event) => setOffice(event.target.value as PlacesOfficeKey)}
            className={`${inputClassName ?? ''} bg-white`}
          >
            {PLACES_OFFICES.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>
      <input
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(event.target.value.trim().length >= 3)
        }}
        onFocus={() => setOpen(trimmedValue.length >= 3 && suggestions.length > 0)}
        required={required}
        autoComplete="organization"
        className={inputClassName}
      />
      {(open || loading || error) && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {loading && (
            <div className="px-3 py-2 text-sm text-slate-500">Searching Google Places...</div>
          )}
          {!loading && error && (
            <div className="px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {!loading && !error && suggestions.length === 0 && trimmedValue.length >= 3 && (
            <div className="px-3 py-2 text-sm text-slate-500">No matches found. You can keep typing manually.</div>
          )}
          {!loading && !error && suggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className="block w-full px-3 py-2 text-left hover:bg-purple-50 focus:bg-purple-50 focus:outline-none"
            >
              <span className="block text-sm font-semibold text-slate-800">{suggestion.mainText}</span>
              {suggestion.secondaryText && (
                <span className="block text-xs text-slate-500">{suggestion.secondaryText}</span>
              )}
              {selectingPlaceId === suggestion.placeId && (
                <span className="block text-xs text-purple-700 mt-0.5">Loading details...</span>
              )}
            </button>
          ))}
          {!loading && !error && suggestions.length > 0 && (
            <div className="flex justify-end border-t border-slate-100 px-3 py-1.5">
              <img
                src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
                alt="Powered by Google"
                className="h-[14px] w-auto"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function createSessionToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}
