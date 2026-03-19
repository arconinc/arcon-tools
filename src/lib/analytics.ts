const GA_ID = 'G-6FMMVL6CVF'

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
    dataLayer: unknown[]
  }
}

export function setGAUser(email: string) {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('config', GA_ID, {
    user_id: email,
    user_properties: { email },
  })
}

export function trackPageView(url: string, email?: string) {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', 'page_view', {
    page_location: url,
    ...(email ? { user_id: email } : {}),
  })
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', name, params)
}
