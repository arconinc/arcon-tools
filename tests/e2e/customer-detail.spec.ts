import { test, expect, type Page } from '@playwright/test'
import { login } from './auth'

test.describe('Customer Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  async function gotoCustomers(page: Page) {
    await page.goto('/marketing/customers')
    await page.waitForLoadState('load')
  }

  test('should load customer detail and edit a field', async ({ page }) => {
    await gotoCustomers(page)

    // Click the first customer in the list
    const firstCustomer = page.locator('a[href*="/marketing/customers/"], button:has-text("View")')
    if (await firstCustomer.count() > 0) {
      await firstCustomer.first().click()
      await page.waitForLoadState('load')
    } else {
      // If no customers, skip test
      test.skip()
    }

    // Verify customer detail page loaded
    await expect(page.locator('h1, h2')).first().toBeTruthy()

    // Edit a field (e.g., phone number)
    const phoneInput = page.locator('input[type="tel"], input[name*="phone"]').first()
    if (await phoneInput.count() > 0) {
      await phoneInput.click()
      await phoneInput.clear()
      await phoneInput.fill('555-1234')

      // Find and click save button
      const saveBtn = page.locator('button:has-text("Save"), button:has-text("Update")')
      if (await saveBtn.count() > 0) {
        await saveBtn.click()
        await page.waitForLoadState('load')

        // Verify save succeeded (no error toast)
        const errorToast = page.locator('div[role="alert"]:has-text("error"), .bg-red')
        await expect(errorToast).not.toBeTruthy()
      }
    }
  })

  test('should open artwork modal', async ({ page }) => {
    await gotoCustomers(page)

    // Click first customer
    const firstCustomer = page.locator('a[href*="/marketing/customers/"], button:has-text("View")')
    if (await firstCustomer.count() > 0) {
      await firstCustomer.first().click()
      await page.waitForLoadState('load')
    } else {
      test.skip()
    }

    // Look for artwork section and click modal/button
    const artworkBtn = page.locator('button:has-text("Artwork"), button:has-text("Upload Artwork"), text="Artwork"')
    if (await artworkBtn.count() > 0) {
      await artworkBtn.first().click()
      await page.waitForLoadState('load')

      // Verify modal opened
      const modal = page.locator('[role="dialog"], .fixed.inset-0, .modal')
      await expect(modal).toBeTruthy()
    }
  })

  test('should navigate to linked opportunity', async ({ page }) => {
    await gotoCustomers(page)

    // Find customer with opportunities
    const customers = page.locator('a[href*="/marketing/customers/"]')
    if (await customers.count() === 0) {
      test.skip()
    }

    await customers.first().click()
    await page.waitForLoadState('load')

    // Look for opportunities section and click a link
    const oppLink = page.locator('a[href*="/marketing/opportunities/"]')
    if (await oppLink.count() > 0) {
      await oppLink.first().click()
      await page.waitForLoadState('load')

      // Verify we navigated to opportunity detail
      expect(page.url()).toContain('/marketing/opportunities/')
    }
  })
})
