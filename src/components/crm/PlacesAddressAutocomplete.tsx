'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { PLACES_OFFICES } from '@/lib/google-places'
import type { PlacesAddress, PlacesAutocompleteSuggestion, PlacesOfficeKey } from '@/lib/google-places'

type PlacesAddressAutocompleteProps = {
  label?: string
  placeholder?: string
  initialQuery?: string | null
  onAddressSelect: (address: PlacesAddress) => void
  onPlaceSelect?: (place: any) => void
}

export function PlacesAddressAutocomplete({
  label = 'Lookup Address',
  placeholder = 'Search Google Places...',
  initialQuery,
  onAddressSelect,
  onPlaceSelect,
}: PlacesAddressAutocompleteProps) {
  const [value, setValue] = useState('')
  const [expanded, setExpanded] = useState(false)
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
    if (!expanded) return

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
  }, [expanded, queryParams, trimmedValue.length])

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
      onAddressSelect(data.place.address)
      onPlaceSelect?.(data.place)
      setValue(suggestion.description)
      setExpanded(false)
      setOpen(false)
      setSuggestions([])
      sessionToken.current = createSessionToken()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSelectingPlaceId(null)
    }
  }

  function expandSearch() {
    const query = initialQuery?.trim()
    if (!value.trim() && query) setValue(query)
    setExpanded(true)
    setOpen((value.trim() || query || '').length >= 3)
  }

  if (!expanded) {
    return (
      <div className="relative inline-flex">
        <button
          type="button"
          onClick={expandSearch}
          title="Search Google Places for this address"
          aria-label="Search Google Places for this address"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.5 14.5 3 3" />
            <circle cx="8.5" cy="8.5" r="5.5" />
          </svg>
          Search
        </button>
      </div>
    )
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => { setExpanded(false); setOpen(false) }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m14.5 14.5 3 3" />
          <circle cx="8.5" cy="8.5" r="5.5" />
        </svg>
        Search
      </button>
      <div className="absolute right-0 top-full z-20 mt-2 flex w-[28rem] items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{label}</label>
          <input
            type="text"
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setOpen(event.target.value.trim().length >= 3)
            }}
            onFocus={() => setOpen(trimmedValue.length >= 3 && suggestions.length > 0)}
            placeholder={placeholder}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
          />
        </div>
        <div className="w-36 flex-shrink-0">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Near</label>
          <select
            value={office}
            onChange={(event) => setOffice(event.target.value as PlacesOfficeKey)}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
          >
            {PLACES_OFFICES.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>
      {(open || loading || error) && (
        <div className="absolute right-0 top-full z-30 mt-[5.5rem] w-[28rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {loading && <div className="px-3 py-2 text-sm text-slate-500">Searching Google Places...</div>}
          {!loading && error && <div className="px-3 py-2 text-sm text-red-700">{error}</div>}
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
              {suggestion.secondaryText && <span className="block text-xs text-slate-500">{suggestion.secondaryText}</span>}
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
