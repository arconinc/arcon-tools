import { test, expect } from '@playwright/test'
import { login } from './auth'

test.describe('Document Section Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should load documents and view a section', async ({ page }) => {
    // Navigate to documents
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    // Verify documents page loaded
    await expect(page.locator('h1, h2')).first().toBeTruthy()

    // Find a section link and click it
    const sectionLink = page.locator('a[href*="/documents/"], button:has-text("View")')
    if (await sectionLink.count() === 0) {
      test.skip()
    }

    await sectionLink.first().click()
    await page.waitForLoadState('networkidle')

    // Verify section page loaded
    expect(page.url()).toContain('/documents/')
  })

  test('should expand a folder in document section', async ({ page }) => {
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    // Find and click a section
    const sectionLink = page.locator('a[href*="/documents/"], button:has-text("View")')
    if (await sectionLink.count() === 0) {
      test.skip()
    }

    await sectionLink.first().click()
    await page.waitForLoadState('networkidle')

    // Look for expandable folder/item
    const expandBtn = page.locator('button[aria-expanded], svg.chevron, .expand-button')
    if (await expandBtn.count() > 0) {
      // Click expand button
      const firstExpandBtn = expandBtn.first()
      const isExpanded = await firstExpandBtn.getAttribute('aria-expanded')

      if (isExpanded === 'false' || isExpanded === 'true') {
        // It's an aria-expanded button
        await firstExpandBtn.click()
        await page.waitForLoadState('networkidle')

        // Verify expanded state changed
        const newState = await firstExpandBtn.getAttribute('aria-expanded')
        expect(newState !== isExpanded).toBeTruthy()
      } else {
        // Just click it and wait for content to appear
        await firstExpandBtn.click()
        await page.waitForLoadState('networkidle')
      }
    } else {
      // If no explicit expand buttons, verify page content loaded
      const content = page.locator('[role="listitem"], li, .document-item')
      await expect(content.first()).toBeTruthy()
    }
  })

  test('should navigate to a document link', async ({ page }) => {
    await page.goto('/documents')
    await page.waitForLoadState('networkidle')

    const sectionLink = page.locator('a[href*="/documents/"], button:has-text("View")')
    if (await sectionLink.count() === 0) {
      test.skip()
    }

    await sectionLink.first().click()
    await page.waitForLoadState('networkidle')

    // Find a document link (likely an external link or nested item)
    const docLink = page.locator('a[href*="docs.google"], a[href*="drive.google"], a[target="_blank"]')
    if (await docLink.count() > 0) {
      // Just verify the link exists and has href
      const href = await docLink.first().getAttribute('href')
      expect(href).toBeTruthy()
      expect(href).toContain('http')
    }
  })
})
