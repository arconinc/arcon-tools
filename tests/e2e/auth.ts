import { Page } from '@playwright/test'

/**
 * Log in to the app using the dev-login route.
 * Requires localhost and DEV_LOGIN_EMAIL set in the Next.js server env.
 * Set DEV_LOGIN_SECRET in .env.test and .env.local if you want secret protection.
 */
export async function login(page: Page) {
  const secret = process.env.DEV_LOGIN_SECRET
  let loginUrl = '/api/dev-login'
  if (secret) {
    loginUrl += `?secret=${encodeURIComponent(secret)}`
  }

  const response = await page.goto(loginUrl, { waitUntil: 'domcontentloaded' })

  if (!response?.ok()) {
    throw new Error(`dev-login returned ${response?.status()}: ${response?.statusText()}`)
  }

  // Wait for auth redirect chain to complete — excludes the intermediate /auth/callback
  await page.waitForURL(
    (url) => {
      const s = url.toString()
      return !s.includes('/api/dev-login') && !s.includes('/auth/')
    },
    { timeout: 15000 }
  )

  // If we landed on the login page the auth flow failed (bad email, missing user, etc.)
  const finalUrl = page.url()
  if (finalUrl.includes('/login')) {
    throw new Error(
      `Login failed: ended up on ${finalUrl}. ` +
        `Check that DEV_LOGIN_EMAIL in .env.local matches a real user in the users table.`
    )
  }
}
