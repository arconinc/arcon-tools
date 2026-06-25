export type PlacesOfficeKey = 'eagan' | 'scottsdale' | 'denver' | 'anywhere'

export type PlacesOffice = {
  key: PlacesOfficeKey
  label: string
  location: {
    latitude: number
    longitude: number
    radius: number
  } | null
}

export type PlacesAutocompleteSuggestion = {
  placeId: string
  mainText: string
  secondaryText: string | null
  description: string
}

export type PlacesAddress = {
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
}

export type PlacesDetails = {
  placeId: string
  name: string | null
  formattedAddress: string | null
  phone: string | null
  website: string | null
  address: PlacesAddress
  location: {
    latitude: number
    longitude: number
  } | null
}

export const PLACES_OFFICES: PlacesOffice[] = [
  {
    key: 'eagan',
    label: 'Eagan, MN',
    location: { latitude: 44.8041, longitude: -93.1669, radius: 50000 },
  },
  {
    key: 'scottsdale',
    label: 'Scottsdale, AZ',
    location: { latitude: 33.4942, longitude: -111.9261, radius: 50000 },
  },
  {
    key: 'denver',
    label: 'Denver, CO',
    location: { latitude: 39.7392, longitude: -104.9903, radius: 50000 },
  },
  {
    key: 'anywhere',
    label: 'Anywhere in US',
    location: null,
  },
]

export function getPlacesOffice(key: string | null | undefined): PlacesOffice {
  return PLACES_OFFICES.find((office) => office.key === key) ?? PLACES_OFFICES[0]
}

type GoogleAddressComponent = {
  longText?: string
  shortText?: string
  types?: string[]
}

export function parseGoogleAddress(components: GoogleAddressComponent[] | null | undefined): PlacesAddress {
  const byType = (type: string) => components?.find((component) => component.types?.includes(type))
  const streetNumber = byType('street_number')?.longText
  const route = byType('route')?.longText
  const subpremise = byType('subpremise')?.longText
  const city = byType('locality')?.longText
    ?? byType('postal_town')?.longText
    ?? byType('administrative_area_level_3')?.longText
  const state = byType('administrative_area_level_1')?.shortText
    ?? byType('administrative_area_level_1')?.longText
  const postalCode = byType('postal_code')?.longText
  const postalSuffix = byType('postal_code_suffix')?.longText
  const country = byType('country')?.shortText ?? byType('country')?.longText

  return {
    address1: [streetNumber, route].filter(Boolean).join(' ') || null,
    address2: subpremise ? `Suite ${subpremise}` : null,
    city: city ?? null,
    state: state ?? null,
    postalCode: [postalCode, postalSuffix].filter(Boolean).join('-') || null,
    country: country ?? null,
  }
}
