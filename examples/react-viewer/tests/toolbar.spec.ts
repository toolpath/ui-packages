import { expect, test } from '@playwright/test'
import { on, openViewer, readCamera } from './canvas.js'

for (const projection of ['perspective', 'orthographic'] as const) {
  test(`stock, axes and wireframe preserve part interaction (${projection})`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    const { canvas, box } = await openViewer(page, `projection=${projection}`)
    const controls = page.getByRole('group', { name: 'Viewer controls', exact: true })
    const toolbarBox = await controls.boundingBox()
    expect(toolbarBox!.y).toBeGreaterThan(box.y + box.height * 0.75)
    const original = await canvas.screenshot()
    await page.getByRole('button', { name: 'Hide axis', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Show axis', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect.poll(async () => Buffer.compare(original, await canvas.screenshot())).not.toBe(0)

    const withoutAxes = await canvas.screenshot()
    await page.getByRole('button', { name: 'Hide grid', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Show grid', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect
      .poll(async () => Buffer.compare(withoutAxes, await canvas.screenshot()))
      .not.toBe(0)

    const beforeStock = await canvas.screenshot()
    const before = await readCamera(page)
    await page.getByRole('button', { name: 'Show stock', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Hide stock', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect
      .poll(async () => Buffer.compare(beforeStock, await canvas.screenshot()))
      .not.toBe(0)
    expect((await readCamera(page)).distance).toBeCloseTo(before.distance, 5)
    await expect(page.locator('p', { hasText: 'Stock:' })).toContainText('25.91 × 25.91 × 25.91')
    await canvas.click({ position: on(box, { x: 0.5, y: 0.5 }) })
    await expect(page.locator('p', { hasText: 'Selected:' })).toContainText(
      projection === 'perspective' ? 'back-face' : 'front-face',
    )

    await page.getByRole('button', { name: 'Fit', exact: true }).click()
    await expect
      .poll(async () => (await readCamera(page)).distance)
      .toBeGreaterThan(before.distance)
    const fittedStock = await readCamera(page)
    await page.getByRole('spinbutton', { name: 'Stock X dimension (mm)' }).fill('37.4')
    await page.getByRole('spinbutton', { name: 'Stock Y dimension (mm)' }).fill('37.4')
    await page.getByRole('spinbutton', { name: 'Stock Z dimension (mm)' }).fill('37.4')
    await expect(page.locator('p', { hasText: 'Stock:' })).toContainText('37.40 × 37.40 × 37.40')
    await page.getByRole('button', { name: 'Fit', exact: true }).click()
    await expect
      .poll(async () => (await readCamera(page)).distance)
      .toBeGreaterThan(fittedStock.distance)
    await page.getByRole('button', { name: 'Hide stock', exact: true }).click()
    await page.getByRole('button', { name: 'Reset', exact: true }).click()
    await expect.poll(async () => (await readCamera(page)).distance).toBeCloseTo(before.distance, 5)

    // Clear the selection before comparing the unpainted solid and wireframe.
    await canvas.click({ position: on(box, { x: 0.05, y: 0.05 }) })
    await page.mouse.move(10, 10)
    const solid = await canvas.screenshot()
    await page.getByRole('button', { name: 'Wireframe', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Wireframe', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect.poll(async () => Buffer.compare(solid, await canvas.screenshot())).not.toBe(0)
    await canvas.click({ position: on(box, { x: 0.5, y: 0.5 }) })
    await expect(page.locator('p', { hasText: 'Selected:' })).not.toContainText('none')
    await page.getByRole('button', { name: 'Section', exact: true }).click()
    await canvas.click({ position: on(box, { x: 0.5, y: 0.5 }) })
    await expect(page.locator('p', { hasText: 'Cut:' })).toContainText('Part surface')
    await page.getByRole('button', { name: 'Measure', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Exit section', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.locator('p', { hasText: 'Cut:' })).toContainText('Part surface')
    expect(errors).toEqual([])
  })

  test(`direction colors scope picks and reset with the model (${projection})`, async ({
    page,
  }) => {
    const { canvas, box } = await openViewer(page, `projection=${projection}`)
    const before = await canvas.screenshot()
    const highlights = page.getByRole('button', { name: 'Highlight faces by direction' })
    await highlights.click()
    await expect(highlights).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(async () => Buffer.compare(before, await canvas.screenshot())).not.toBe(0)
    // +X cannot own the face at the centre in either opening projection.
    await page.getByRole('button', { name: '+X', exact: true }).click()
    await canvas.click({ position: on(box, { x: 0.5, y: 0.5 }) })
    await expect(page.locator('p', { hasText: 'Selected:' })).toContainText('none')
    await page
      .getByRole('button', { name: projection === 'perspective' ? '−Z' : '+Z', exact: true })
      .click()
    await canvas.click({ position: on(box, { x: 0.5, y: 0.5 }) })
    await expect(page.locator('p', { hasText: 'Selected:' })).toContainText(
      projection === 'perspective' ? 'back-face' : 'front-face',
    )
    await page.getByRole('combobox').first().selectOption('plate')
    await expect(page.locator('p', { hasText: 'Direction:' })).toContainText('all')
    await expect(page.locator('p', { hasText: 'Selected:' })).toContainText('none')
    await page.getByRole('button', { name: 'Wireframe', exact: true }).click()
    await expect(highlights).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('group', { name: 'Machining directions' })).toHaveCount(0)
    await highlights.click()
    await expect(page.getByRole('button', { name: 'Wireframe', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test(`focus fades geometry outside the selected feature (${projection})`, async ({ page }) => {
    const { canvas, box } = await openViewer(page, `projection=${projection}`)
    await canvas.click({ position: on(box, { x: 0.5, y: 0.5 }) })
    await expect(page.locator('p', { hasText: 'Selected:' })).not.toContainText('none')
    const selected = await canvas.screenshot()
    const focus = page.getByRole('button', { name: 'Focus selection', exact: true })

    await focus.click()

    await expect(page.getByRole('button', { name: 'Show full part', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect.poll(async () => Buffer.compare(selected, await canvas.screenshot())).not.toBe(0)
    const focused = await canvas.screenshot()
    await page.getByRole('button', { name: 'Show full part', exact: true }).click()
    await expect(focus).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(async () => Buffer.compare(focused, await canvas.screenshot())).not.toBe(0)
  })

  test(`stock present on mount does not move the section midpoint (${projection})`, async ({
    page,
  }) => {
    const { canvas, box } = await openViewer(page, `projection=${projection}&stock=on`)
    await page.getByRole('button', { name: 'Section', exact: true }).click()
    await canvas.click({ position: on(box, { x: 0.5, y: 0.5 }) })
    await page.getByRole('slider', { name: 'Cut depth' }).fill('0.5')
    await expect(page.locator('p', { hasText: 'Cut:' })).toContainText('12.70 mm in')
  })
}

test('the toolbar remains reachable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openViewer(page)
  const controls = page.getByRole('group', { name: 'Viewer controls', exact: true })
  await controls.scrollIntoViewIfNeeded()
  const box = await controls.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: 'Show stock', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Hide stock', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
