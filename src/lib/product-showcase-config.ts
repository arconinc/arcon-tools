// Shared event constants for the Product Showcase 2026.
// Kept separate so client components can import without pulling in server-only email code.

export const SHOWCASE_EVENT = {
  title: 'Arcon Product Showcase 2026',
  date: 'Friday, September 18, 2026',
  time: '11:00 AM – 2:00 PM CT',
  venue: 'Union 32 Craft House',
  address: '2864 Highway 55, Eagan, MN 55121',
  description:
    'Join Arcon Inc. for our annual Product Showcase! Explore the latest in promotional products, apparel, branded gifts, and more. Meet the Arcon team and discover fresh ideas for your brand.',
} as const

const encodedTitle = encodeURIComponent(SHOWCASE_EVENT.title)
const encodedLocation = encodeURIComponent(`${SHOWCASE_EVENT.venue}, ${SHOWCASE_EVENT.address}`)
const encodedDesc = encodeURIComponent(SHOWCASE_EVENT.description)

// September 18, 2026 11am–2pm CDT = 16:00–19:00 UTC
export const CALENDAR_LINKS = {
  google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedTitle}&dates=20260918T160000Z/20260918T190000Z&details=${encodedDesc}&location=${encodedLocation}`,
  outlook: `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodedTitle}&startdt=2026-09-18T11:00:00-05:00&enddt=2026-09-18T14:00:00-05:00&location=${encodedLocation}&body=${encodedDesc}`,
}
