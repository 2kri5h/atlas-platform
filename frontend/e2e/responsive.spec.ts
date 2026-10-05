import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function expectNoHorizontalOverflow(page: Page) {
  const overflows = await page.locator('body').evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflows).toBe(false)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.layout')).toBeVisible()
})

test('navigation adapts without hiding content or keyboard focus', async ({ page }, testInfo) => {
  const width = testInfo.project.use.viewport?.width ?? 1280
  await expectNoHorizontalOverflow(page)

  if (width < 768) {
    const dock = page.getByRole('navigation', { name: 'Mobile Navigation' })
    await expect(dock).toBeVisible()
    await expect(dock.getByText('Today', { exact: true })).toBeVisible()
    await expect(dock.getByText('Planner', { exact: true })).toBeVisible()
    await expect(dock.getByText('Tasks', { exact: true })).toBeVisible()
    const more = dock.getByRole('button', { name: 'More Features' })
    await more.focus()
    await more.click()
    const dialog = page.getByRole('dialog', { name: 'More' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'AI Mentor' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('more-open.png'), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(more).toBeFocused()
  } else {
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Mobile Navigation' })).toBeHidden()
  }

  await page.screenshot({ path: testInfo.outputPath('navigation.png'), fullPage: true })
})

test('primary pages remain usable at the configured viewport', async ({ page }, testInfo) => {
  const consoleErrors: string[] = []
  const clientErrors: string[] = []
  const serverErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('response', response => {
    if (response.status() >= 400 && response.status() < 500) {
      clientErrors.push(`${response.status()} ${response.url()}`)
    }
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`)
  })

  for (const route of ['/', '/planner', '/deadlines', '/emails', '/resources', '/events']) {
    await page.goto(route)
    await expect(page.locator('.loading, .grid-loading, .ui-loading')).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
    await page.screenshot({
      path: testInfo.outputPath(`${route === '/' ? 'today' : route.slice(1)}.png`),
      fullPage: true,
    })
  }

  expect(clientErrors, 'unexpected client-error responses').toEqual([])
  expect(serverErrors, 'server responses with 5xx status').toEqual([])
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test('phone defaults and accessible sheet behavior are preserved', async ({ page }, testInfo) => {
  const width = testInfo.project.use.viewport?.width ?? 1280
  test.skip(width >= 768, 'Phone-only behavior')

  await page.goto('/deadlines')
  await page.getByRole('button', { name: /Filter/i }).first().click()
  const filterDialog = page.getByRole('dialog', { name: /Task filters/i })
  await expect(filterDialog).toBeVisible()
  await expect(filterDialog.getByRole('button', { name: 'List', exact: true })).toHaveClass(/active/)
  await page.keyboard.press('Escape')

  await page.goto('/planner')
  await expect(page.getByRole('button', { name: 'Day', exact: true })).toHaveClass(/active/)
  await expectNoHorizontalOverflow(page)

  await page.setViewportSize({ width: testInfo.project.use.viewport?.height ?? 800, height: width })
  await expectNoHorizontalOverflow(page)
})

test('dashboard has no automatically detectable WCAG A/AA violations', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('phone dashboard meets the throttled Core Web Vitals budget', async ({ page }, testInfo) => {
  const width = testInfo.project.use.viewport?.width ?? 1280
  test.skip(width !== 390, 'Performance profile runs once on the representative phone')

  const session = await page.context().newCDPSession(page)
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'More Features' }).click()
  await expect(page.getByRole('dialog', { name: 'More' })).toBeVisible()
  await page.waitForTimeout(500)

  const metrics = await page.evaluate(() => {
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint')
    const layoutEntries = performance.getEntriesByType('layout-shift') as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>
    const eventEntries = performance.getEntriesByType('event') as Array<PerformanceEntry & { duration: number }>
    return {
      lcp: lcpEntries.at(-1)?.startTime ?? 0,
      cls: layoutEntries.filter(entry => !entry.hadRecentInput).reduce((sum, entry) => sum + entry.value, 0),
      inp: eventEntries.reduce((maximum, entry) => Math.max(maximum, entry.duration), 0),
    }
  })

  await testInfo.attach('web-vitals.json', {
    body: Buffer.from(JSON.stringify(metrics, null, 2)),
    contentType: 'application/json',
  })

  expect(metrics.lcp).toBeLessThanOrEqual(2500)
  expect(metrics.cls).toBeLessThanOrEqual(0.1)
  expect(metrics.inp).toBeLessThanOrEqual(200)
})
