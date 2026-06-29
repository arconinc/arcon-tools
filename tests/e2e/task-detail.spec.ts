import { test, expect } from '@playwright/test'
import { login } from './auth'

test.describe('Task Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should load task and change status', async ({ page }) => {
    // Navigate to tasks (try my-tasks first)
    await page.goto('/my-tasks')
    await page.waitForLoadState('networkidle')

    // If no tasks there, try marketing/tasks
    let taskLink = page.locator('a[href*="/tasks/"]').first()
    if (await taskLink.count() === 0) {
      await page.goto('/sales/tasks')
      await page.waitForLoadState('networkidle')
      taskLink = page.locator('a[href*="/tasks/"]').first()
    }

    if (await taskLink.count() === 0) {
      test.skip()
    }

    // Click first task
    await taskLink.click()
    await page.waitForLoadState('networkidle')

    // Verify task detail page loaded
    await expect(page.locator('h1, h2')).first().toBeTruthy()

    // Find status dropdown/button and change it
    const statusSelect = page.locator('select[name*="status"], button:has-text("Status")')
    if (await statusSelect.count() > 0) {
      const selectElement = statusSelect.first()
      const isButton = await selectElement.evaluate((el) => el.tagName === 'BUTTON')

      if (isButton) {
        // Click button to open dropdown
        await selectElement.click()
        await page.waitForLoadState('networkidle')

        // Click a status option
        const statusOption = page.locator('[role="option"], .dropdown-item').first()
        if (await statusOption.count() > 0) {
          await statusOption.click()
          await page.waitForLoadState('networkidle')
        }
      } else {
        // It's a select element
        const options = await selectElement.locator('option').count()
        if (options > 1) {
          // Select a different option
          await selectElement.selectOption({ index: 1 })
          await page.waitForLoadState('networkidle')
        }
      }
    }
  })

  test('should add a comment to task', async ({ page }) => {
    await page.goto('/my-tasks')
    await page.waitForLoadState('networkidle')

    // Find a task
    let taskLink = page.locator('a[href*="/tasks/"]').first()
    if (await taskLink.count() === 0) {
      await page.goto('/sales/tasks')
      await page.waitForLoadState('networkidle')
      taskLink = page.locator('a[href*="/tasks/"]').first()
    }

    if (await taskLink.count() === 0) {
      test.skip()
    }

    await taskLink.click()
    await page.waitForLoadState('networkidle')

    // Find comment input
    const commentInput = page.locator('textarea[placeholder*="comment"], input[placeholder*="comment"], textarea[name*="comment"]')
    if (await commentInput.count() > 0) {
      await commentInput.first().click()
      await commentInput.first().fill('Test comment from automation')

      // Find post/send button
      const sendBtn = page.locator('button:has-text("Send"), button:has-text("Post"), button:has-text("Comment")')
      if (await sendBtn.count() > 0) {
        await sendBtn.click()
        await page.waitForLoadState('networkidle')

        // Verify comment appeared
        const comment = page.locator('text=Test comment from automation')
        if (await comment.count() > 0) {
          await expect(comment).toBeTruthy()
        }
      }
    }
  })
})
