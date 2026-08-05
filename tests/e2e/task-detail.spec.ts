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
    await expect(page.locator('h1, h2').first()).toBeVisible()

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

  test('should post a reply in the conversation thread', async ({ page }) => {
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

    // The Thread tab is the default view — find the "New Message" composer
    // (top-level messages; per-comment "Add Reply" rows are a separate,
    // always-visible input scoped to each existing message).
    const replyInput = page.locator('textarea[placeholder*="message"]')
    if (await replyInput.count() > 0) {
      const uniqueText = `Test reply from automation ${Date.now()}`
      await replyInput.first().click()
      await replyInput.first().fill(uniqueText)

      const sendBtn = page.locator('button:has-text("Send")').first()
      if (await sendBtn.count() > 0) {
        await sendBtn.click()
        await page.waitForLoadState('networkidle')

        // Verify the reply appeared inline in the thread
        await expect(page.locator(`text=${uniqueText}`)).toBeVisible()
      }
    }
  })

  test('conversation thread shows the description as the opening message and no separate description panel', async ({ page }) => {
    await page.goto('/my-tasks')
    await page.waitForLoadState('networkidle')

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

    // Thread tab is the default landing tab and carries the opening message
    await expect(page.locator('text=Task description').first()).toBeVisible()

    // "Assign to" is explicitly labeled (not just an icon/name with no label)
    await expect(page.locator('text=Assign to').first()).toBeVisible()

    // The old standalone "Attachments" and "Activity" tabs no longer exist —
    // everything lives in the Thread tab now.
    await expect(page.getByRole('button', { name: 'attachments', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'activity', exact: true })).toHaveCount(0)
  })
})
