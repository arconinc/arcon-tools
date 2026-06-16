import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'
import path from 'path'

// Load env files for the test process (later calls don't override earlier ones)
loadEnv({ path: path.resolve(__dirname, '.env.local'), override: false })
loadEnv({ path: path.resolve(__dirname, '.env.test'), override: true })

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      // Override the placeholder in .env.local with the real test credentials
      ...(process.env.DEV_LOGIN_EMAIL ? { DEV_LOGIN_EMAIL: process.env.DEV_LOGIN_EMAIL } : {}),
      ...(process.env.DEV_LOGIN_SECRET ? { DEV_LOGIN_SECRET: process.env.DEV_LOGIN_SECRET } : {}),
    },
  },
})
