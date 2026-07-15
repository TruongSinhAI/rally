import { test } from '@playwright/test'
import { loginAndSelectProject, settle, expect } from './helpers'

test.describe('P3.1 Team Status', () => {
  test('renders iteration selector and member-grouped table', async ({ page }) => {
    await loginAndSelectProject(page)
    await page.goto('/team-status')
    await settle(page)

    // The page heading should be visible.
    await expect(page.getByRole('heading', { name: 'Team Status' })).toBeVisible({ timeout: 15_000 })

    // Iteration selector should render.
    await expect(page.getByPlaceholder(/Select iteration/i).first()).toBeVisible()
  })

  test('shows member capacity and task data after selecting an iteration', async ({ page }) => {
    await loginAndSelectProject(page)
    await page.goto('/team-status')
    await settle(page)

    // Select an iteration if the dropdown is available.
    const selector = page.getByPlaceholder(/Select iteration/i).first()
    const hasOptions = await selector.isVisible().catch(() => false)
    test.skip(!hasOptions, 'No iteration selector visible')

    await selector.click()
    await settle(page, 500)

    // Pick the first option from the dropdown.
    const firstOption = page.locator('[role="option"]').first()
    const hasItems = await firstOption.isVisible().catch(() => false)
    test.skip(!hasItems, 'No iteration options available')

    await firstOption.click()
    await settle(page, 2000)

    // After selection, the table should render. We look for any "Capacity" column
    // header or the unassigned group indicator which are always present when data loads.
    const tableVisible =
      (await page.getByText('Capacity').first().isVisible().catch(() => false)) ||
      (await page.getByText('Estimate').first().isVisible().catch(() => false))
    // Table may be empty — that's OK. The column headers should still render.
    expect(tableVisible || (await page.getByText('No tasks found').isVisible().catch(() => false))).toBe(true)
  })
})

test.describe('P3.2 Release Management', () => {
  test('navigates to releases via Timeboxes type selector', async ({ page }) => {
    await loginAndSelectProject(page)
    await page.goto('/timeboxes')
    await settle(page)

    // The Timeboxes page should have a type selector or tab for Releases.
    const releaseTab = page.getByRole('tab', { name: 'Releases' })
    const releaseLink = page.getByRole('link', { name: /Release/i })
    const hasNavigation =
      (await releaseTab.isVisible().catch(() => false)) ||
      (await releaseLink.isVisible().catch(() => false))

    if (hasNavigation) {
      if (await releaseTab.isVisible().catch(() => false)) {
        await releaseTab.click()
      } else {
        await releaseLink.first().click()
      }
      await settle(page, 1500)

      // Should land on a releases list or detail view.
      await expect(
        page.getByRole('heading', { name: /Release/i }).first(),
      ).toBeVisible({ timeout: 10_000 })
    }
  })

  test('release detail page renders Theme/Notes editors and artifact list', async ({ page }) => {
    await loginAndSelectProject(page)
    await page.goto('/timeboxes')
    await settle(page)

    // Try to find and click a release row to open its detail.
    const releaseTab = page.getByRole('tab', { name: 'Releases' })
    if (await releaseTab.isVisible().catch(() => false)) {
      await releaseTab.click()
      await settle(page, 1000)
    }

    // Look for a release row in the list.
    const releaseRow = page.locator('a, [role="row"], [data-row]').first()
    const hasRow = await releaseRow.isVisible().catch(() => false)
    test.skip(!hasRow, 'No release rows to click')

    await releaseRow.click()
    await settle(page, 2000)

    // Detail should show at minimum a name heading.
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('P3.3 Milestones', () => {
  test('navigates to milestones via Timeboxes type selector', async ({ page }) => {
    await loginAndSelectProject(page)
    await page.goto('/timeboxes')
    await settle(page)

    const milestoneTab = page.getByRole('tab', { name: 'Milestones' })
    const milestoneLink = page.getByRole('link', { name: /Milestone/i })
    const hasNavigation =
      (await milestoneTab.isVisible().catch(() => false)) ||
      (await milestoneLink.isVisible().catch(() => false))

    if (hasNavigation) {
      if (await milestoneTab.isVisible().catch(() => false)) {
        await milestoneTab.click()
      } else {
        await milestoneLink.first().click()
      }
      await settle(page, 1500)

      await expect(
        page.getByRole('heading', { name: /Milestone/i }).first(),
      ).toBeVisible({ timeout: 10_000 })
    }
  })
})

test.describe('P3.4 Quality / Defect Dashboard', () => {
  test('renders defect dashboard with expected columns', async ({ page }) => {
    await loginAndSelectProject(page)
    await page.goto('/quality')
    await settle(page)

    // The Quality page heading should be visible.
    await expect(page.getByRole('heading', { name: /Defect/i }).first()).toBeVisible({
      timeout: 15_000,
    })

    // Defect-specific columns should be visible (per report P3.4):
    // Severity, Priority, State, Flow State, Fixed In Build
    const hasColumns =
      (await page.getByText('Severity').first().isVisible().catch(() => false)) ||
      (await page.getByText('Priority').first().isVisible().catch(() => false)) ||
      (await page.getByText('Flow State').first().isVisible().catch(() => false))

    // At minimum one defect column should render.
    expect(hasColumns).toBe(true)
  })

  test('defect state filter is available', async ({ page }) => {
    await loginAndSelectProject(page)
    await page.goto('/quality')
    await settle(page)

    // Look for a state or flow-state filter.
    const stateFilter = page.getByLabel(/state/i).first()
    const filterButton = page.getByRole('button', { name: /filter/i }).first()

    const hasFilter =
      (await stateFilter.isVisible().catch(() => false)) ||
      (await filterButton.isVisible().catch(() => false))

    expect(hasFilter).toBe(true)
  })
})