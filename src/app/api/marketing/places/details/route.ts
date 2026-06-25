import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/crm/require-user'
import { parseGoogleAddress } from '@/lib/google-places'
import type { PlacesDetails } from '@/lib/google-places'
import { getGooglePlacesApiKey } from '@/lib/google-places-server'

export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const placeId = searchParams.get('placeId')?.trim()
  if (!placeId) return NextResponse.json({ error: 'placeId is required' }, { status: 400 })
  const sessionToken = searchParams.get('sessionToken')?.trim()

  const apiKey = getGooglePlacesApiKey()
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Places API key is not configured.' }, { status: 500 })
  }

  const googleParams = new URLSearchParams({
    languageCode: 'en',
    regionCode: 'us',
    ...(sessionToken ? { sessionToken } : {}),
  })

  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${googleParams.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'id',
        'displayName',
        'formattedAddress',
        'nationalPhoneNumber',
        'internationalPhoneNumber',
        'websiteUri',
        'addressComponents',
        'location',
      ].join(','),
    },
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Google Places details lookup failed.' }, { status: 502 })
  }

  const place = await response.json()
  const details: PlacesDetails = {
    placeId: place.id,
    name: place.displayName?.text ?? null,
    formattedAddress: place.formattedAddress ?? null,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
    address: parseGoogleAddress(place.addressComponents),
    location: place.location
      ? {
          latitude: place.location.latitude,
          longitude: place.location.longitude,
        }
      : null,
  }

  return NextResponse.json({ place: details })
}
