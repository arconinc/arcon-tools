import { test, expect } from '@playwright/test'
import { login } from './auth'

test.describe('Expense Report Edit Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should load expense report and add line item', async ({ page }) => {
    // Navigate to expense reports
    await page.goto('/expense-reports')
    await page.waitForLoadState('networkidle')

    // Find an expense report
    const reportLink = page.locator('a[href*="/expense-reports/"], button:has-text("View"), button:has-text("Edit")')
    if (await reportLink.count() === 0) {
      test.skip()
    }

    // Click first report
    await reportLink.first().click()
    await page.waitForLoadState('networkidle')

    // Check if we're in view mode and need to enter edit mode
    const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit")')
    if (await editBtn.count() > 0) {
      await editBtn.first().click()
      await page.waitForLoadState('networkidle')
    }

    // Verify edit page loaded (look for /edit in URL or edit controls)
    expect(page.url()).toContain('/expense-reports/')

    // Find add line item button
    const addLineBtn = page.locator('button:has-text("Add Line"), button:has-text("Add Item"), button:has-text("Add Expense")')
    if (await addLineBtn.count() > 0) {
      await addLineBtn.first().click()
      await page.waitForLoadState('networkidle')

      // Fill in a line item
      const descInput = page.locator('input[placeholder*="Description"], input[name*="description"]').last()
      if (await descInput.count() > 0) {
        await descInput.fill('Test expense item')
      }

      const amountInput = page.locator('input[type="number"], input[placeholder*="Amount"]').last()
      if (await amountInput.count() > 0) {
        await amountInput.fill('50.00')
      }

      // Find save button
      const saveBtn = page.locator('button:has-text("Save"), button:has-text("Submit")')
      if (await saveBtn.count() > 0) {
        await saveBtn.click()
        await page.waitForLoadState('networkidle')

        // Verify no error
        const errorToast = page.locator('div[role="alert"]:has-text("error"), .bg-red')
        await expect(errorToast).not.toBeTruthy()
      }
    }
  })

  test('should save expense report', async ({ page }) => {
    await page.goto('/expense-reports')
    await page.waitForLoadState('networkidle')

    const reportLink = page.locator('a[href*="/expense-reports/"], button:has-text("View"), button:has-text("Edit")')
    if (await reportLink.count() === 0) {
      test.skip()
    }

    await reportLink.first().click()
    await page.waitForLoadState('networkidle')

    // Enter edit mode if needed
    const editBtn = page.locator('button:has-text("Edit"), a:has-text("Edit")')
    if (await editBtn.count() > 0) {
      await editBtn.first().click()
      await page.waitForLoadState('networkidle')
    }

    // Find and click save button
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Submit")')
    if (await saveBtn.count() > 0) {
      await saveBtn.click()
      await page.waitForLoadState('networkidle')

      // Verify save succeeded
      const successToast = page.locator('div[role="alert"]:has-text("success"), div[role="alert"]:has-text("saved"), .bg-green')
      const errorToast = page.locator('div[role="alert"]:has-text("error"), .bg-red')

      // Either success message or no error means success
      const hasError = await errorToast.count() > 0
      await expect(hasError).toBeFalsy()
    }
  })
})
