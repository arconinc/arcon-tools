# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: customer-detail.spec.ts >> Customer Detail Page >> should open artwork modal
- Location: tests/e2e/customer-detail.spec.ts:51:7

# Error details

```
Error: Login failed: ended up on http://localhost:3000/login?error=auth_failed. Check that DEV_LOGIN_EMAIL in .env.local matches a real user in the users table.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]:
    - img [ref=e8]
  - alert [ref=e11]
  - paragraph [ref=e15]: Loading…
```

# Test source

```ts
  1  | import { Page } from '@playwright/test'
  2  | 
  3  | /**
  4  |  * Log in to the app using the dev-login route.
  5  |  * Requires NODE_ENV=development and DEV_LOGIN_EMAIL set in the Next.js server env.
  6  |  * Set DEV_LOGIN_SECRET in .env.test and .env.local if you want secret protection.
  7  |  */
  8  | export async function login(page: Page) {
  9  |   const secret = process.env.DEV_LOGIN_SECRET
  10 |   let loginUrl = '/api/dev-login'
  11 |   if (secret) {
  12 |     loginUrl += `?secret=${encodeURIComponent(secret)}`
  13 |   }
  14 | 
  15 |   const response = await page.goto(loginUrl, { waitUntil: 'domcontentloaded' })
  16 | 
  17 |   if (!response?.ok()) {
  18 |     throw new Error(`dev-login returned ${response?.status()}: ${response?.statusText()}`)
  19 |   }
  20 | 
  21 |   // Wait for auth redirect chain to complete — excludes the intermediate /auth/callback
  22 |   await page.waitForURL(
  23 |     (url) => {
  24 |       const s = url.toString()
  25 |       return !s.includes('/api/dev-login') && !s.includes('/auth/')
  26 |     },
  27 |     { timeout: 15000 }
  28 |   )
  29 | 
  30 |   // If we landed on the login page the auth flow failed (bad email, missing user, etc.)
  31 |   const finalUrl = page.url()
  32 |   if (finalUrl.includes('/login')) {
> 33 |     throw new Error(
     |           ^ Error: Login failed: ended up on http://localhost:3000/login?error=auth_failed. Check that DEV_LOGIN_EMAIL in .env.local matches a real user in the users table.
  34 |       `Login failed: ended up on ${finalUrl}. ` +
  35 |         `Check that DEV_LOGIN_EMAIL in .env.local matches a real user in the users table.`
  36 |     )
  37 |   }
  38 | }
  39 | 
```