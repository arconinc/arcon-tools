import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/crm/require-user'
import { getPlacesOffice } from '@/lib/google-places'
import type { PlacesAutocompleteSuggestion } from '@/lib/google-places'
import { getGooglePlacesApiKey } from '@/lib/google-places-server'

export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const input = searchParams.get('input')?.trim() ?? ''
  if (input.length < 3) return NextResponse.json({ suggestions: [] })

  const apiKey = getGooglePlacesApiKey()
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Places API key is not configured.' }, { status: 500 })
  }

  const office = getPlacesOffice(searchParams.get('office'))
  const sessionToken = searchParams.get('sessionToken')?.trim()
  const body: Record<string, unknown> = {
    input,
    includedRegionCodes: ['us'],
    regionCode: 'us',
    languageCode: 'en',
    includePureServiceAreaBusinesses: true,
    ...(sessionToken ? { sessionToken } : {}),
  }

  if (office.location) {
    body.locationBias = {
      circle: {
        center: {
          latitude: office.location.latitude,
          longitude: office.location.longitude,
        },
        radius: office.location.radius,
      },
    }
  }

  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'suggestions.placePrediction.placeId',
        'suggestions.placePrediction.text.text',
        'suggestions.placePrediction.structuredFormat.mainText.text',
        'suggestions.placePrediction.structuredFormat.secondaryText.text',
      ].join(','),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Google Places autocomplete failed.' }, { status: 502 })
  }

  const data = await response.json()
  const suggestions: PlacesAutocompleteSuggestion[] = (data.suggestions ?? [])
    .map((suggestion: any) => suggestion.placePrediction)
    .filter(Boolean)
    .map((prediction: any) => ({
      placeId: prediction.placeId,
      mainText: prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? '',
      secondaryText: prediction.structuredFormat?.secondaryText?.text ?? null,
      description: prediction.text?.text ?? [
        prediction.structuredFormat?.mainText?.text,
        prediction.structuredFormat?.secondaryText?.text,
      ].filter(Boolean).join(', '),
    }))
    .filter((suggestion: PlacesAutocompleteSuggestion) => suggestion.placeId && suggestion.mainText)

  return NextResponse.json({ suggestions })
}
