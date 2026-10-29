import { expect, test } from '@playwright/test'
import { openViewer, readCamera, type CameraPose } from './canvas'

test.beforeEach(async ({ page }) => {
  // Full Chromium requests an icon automatically; this example has no icon asset.
  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204 }))
})

const roundedCamera = (pose: CameraPose) =>
  [pose.zoom, pose.distance, ...pose.target, ...pose.position].map((value) =>
    Number(value.toFixed(6)),
  )

for (const projection of ['perspective', 'orthographic']) {
  test(`explode preserves the camera through transitions and color changes until Fit is requested (${projection})`, async ({
    page,
  }) => {
    await openViewer(page, `model=brick&projection=${projection}`)
    const opening = await readCamera(page)
    const expectHeld = async (pose: CameraPose) => {
      await expect
        .poll(async () => roundedCamera(await readCamera(page)))
        .toEqual(roundedCamera(pose))
    }
    await page.getByRole('button', { name: 'Explode', exact: true }).click()
    const amount = page.getByRole('slider', { name: 'Explosion amount' })
    await expect(amount).not.toHaveValue('0')
    await expectHeld(opening)
    await expect(amount).toHaveValue('1')
    await expectHeld(opening)
    await page.getByRole('button', { name: 'Direction', exact: true }).click()
    await expectHeld(opening)
    await page.getByRole('button', { name: 'Feature', exact: true }).click()
    await amount.fill('0.4')
    await expectHeld(opening)
    await amount.fill('1')
    await page.getByRole('button', { name: 'Fit', exact: true }).click()
    await expect
      .poll(async () => (await readCamera(page)).distance)
      .toBeGreaterThan(opening.distance * 2)
    // Fit is an explicit camera transition. Let it settle before freezing the
    // expected pose; collapse must preserve the completed view, not an in-flight one.
    let fitted: CameraPose | undefined
    let stableSamples = 0
    await expect
      .poll(
        async () => {
          const next = await readCamera(page)
          stableSamples =
            fitted &&
            roundedCamera(next).every((value, index) => value === roundedCamera(fitted!)[index])
              ? stableSamples + 1
              : 0
          fitted = next
          return stableSamples
        },
        { intervals: [100] },
      )
      .toBeGreaterThanOrEqual(2)
    await page.getByRole('button', { name: 'Collapse', exact: true }).click()
    await expect(amount).not.toHaveValue('1')
    await expectHeld(fitted!)
    await expect(page.getByRole('group', { name: 'Explode options' })).toHaveCount(0)
    await expectHeld(fitted!)
    await page.getByRole('button', { name: 'Explode', exact: true }).click()
    await expect(amount).toHaveValue('1')
    await expectHeld(fitted!)
  })
}

test('recolors the same feature pieces without rebuilding buffers or losing selection', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const counts = { created: 0, deleted: 0, programs: 0 }
    Object.assign(window, { __explodeBufferCounts: counts })
    const prototype = WebGL2RenderingContext.prototype
    const create = prototype.createBuffer
    const dispose = prototype.deleteBuffer
    const createProgram = prototype.createProgram
    prototype.createProgram = function () {
      counts.programs += 1
      return createProgram.call(this)
    }
    prototype.createBuffer = function () {
      counts.created += 1
      return create.call(this)
    }
    prototype.deleteBuffer = function (buffer) {
      counts.deleted += 1
      return dispose.call(this, buffer)
    }
  })
  const readBuffers = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            __explodeBufferCounts: { created: number; deleted: number; programs: number }
          }
        ).__explodeBufferCounts,
    )
  const { canvas, box } = await openViewer(page, 'model=brick')
  await expect(page.getByRole('button', { name: 'Explode', exact: true })).toBeEnabled()
  const prepared = await readBuffers()
  await page.getByRole('button', { name: 'Explode', exact: true }).click()
  const amount = page.getByRole('slider', { name: 'Explosion amount' })
  await amount.fill('0.7')
  expect((await readBuffers()).programs).toBe(prepared.programs)
  await page.getByRole('button', { name: 'Top view', exact: true }).click()
  await page.waitForTimeout(800)
  const colors = page.getByRole('group', { name: 'Color by', exact: true })
  const selected = page.locator('p', { hasText: 'Selected:' })
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } })
  await expect(selected).toHaveText('Selected: face-11')
  await page.mouse.move(0, 0)
  const featurePaint = await canvas.screenshot()
  const buffers = await readBuffers()
  await colors.getByRole('button', { name: 'Direction', exact: true }).click()
  await expect(selected).toHaveText('Selected: face-11')
  await expect(amount).toHaveValue('0.7')
  await expect(colors.getByRole('button', { name: 'Direction', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect.poll(async () => Buffer.compare(featurePaint, await canvas.screenshot())).not.toBe(0)
  expect(await readBuffers()).toEqual(buffers)
  // The loaded part owns a cached batch. Closing and reopening must not rebuild it.
  await page.getByRole('button', { name: 'Collapse', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Explode options', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Explode', exact: true }).click()
  await expect(amount).toHaveValue('1')
  expect(await readBuffers()).toEqual(buffers)
})

test('direction colors preserve distinct feature picks and hover identities for the same approach', async ({
  page,
}) => {
  const { canvas, box } = await openViewer(page, 'model=brick')
  await page.getByRole('button', { name: 'Explode', exact: true }).click()
  const amount = page.getByRole('slider', { name: 'Explosion amount' })
  await amount.fill('0.7')
  await page.getByRole('button', { name: 'Top view', exact: true }).click()
  await page.waitForTimeout(800)
  const colors = page.getByRole('group', { name: 'Color by', exact: true })
  const selected = page.locator('p', { hasText: 'Selected:' })
  const hovered = page.locator('p', { hasText: 'Hovered:' })
  await colors.getByRole('button', { name: 'Direction', exact: true }).click()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await expect(hovered).toHaveText('Hovered: face-11')
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } })
  await expect(selected).toHaveText('Selected: face-11')
  // The upper-left stud cap and the body top share +Z, but remain separate features.
  const second = { x: box.width * 0.475, y: box.height * 0.4 }
  await canvas.click({ position: second })
  await expect(selected).toHaveText('Selected: face-34')
  await colors.getByRole('button', { name: 'Feature', exact: true }).click()
  await expect(selected).toHaveText('Selected: face-34')
  await expect(amount).toHaveValue('0.7')
  await page.mouse.move(box.x + second.x, box.y + second.y)
  await expect(hovered).toHaveText('Hovered: face-34')
})

for (const projection of ['perspective', 'orthographic']) {
  test(`the toolbar exposes one explode control and restores normal picking (${projection})`, async ({
    page,
  }) => {
    const errors: Array<string> = []
    page.on('pageerror', (error) => errors.push(error.message))
    const { canvas, box } = await openViewer(page, `projection=${projection}`)
    const options = page.getByRole('group', { name: 'Explode options', exact: true })
    await expect(options).toHaveCount(0)
    await page.getByRole('button', { name: 'Explode', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Collapse', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    const amount = page.getByRole('slider', { name: 'Explosion amount' })
    await expect(amount).toHaveValue('1')
    await expect(options.getByRole('slider')).toHaveCount(1)
    await expect(options.getByRole('combobox')).toHaveCount(0)
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } })
    // The original mesh stays mounted but leaves picking while the exploded copies are shown.
    await expect(page.locator('p', { hasText: 'Selected:' })).toContainText('none')
    await page.getByRole('button', { name: 'Top view', exact: true }).click()
    await page.waitForTimeout(800)
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } })
    await expect(page.locator('p', { hasText: 'Selected:' })).toContainText('front-face')
    await page.getByRole('button', { name: 'Collapse', exact: true }).click()
    await expect(options).toHaveCount(0)
    await page.waitForTimeout(800)
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } })
    await expect(page.locator('p', { hasText: 'Selected:' })).toContainText('front-face')
    // Repeat the round trip. A cleared normal mesh must not be mistaken for a working collapse.
    await page.getByRole('button', { name: 'Explode', exact: true }).click()
    await amount.fill('1')
    await page.getByRole('button', { name: 'Collapse', exact: true }).click()
    await expect(options).toHaveCount(0)
    await page.waitForTimeout(800)
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } })
    await expect(page.locator('p', { hasText: 'Selected:' })).toContainText('front-face')
    expect(errors).toEqual([])
  })
}

test('explode and assembled analysis tools switch modes without carrying stale cuts or measurements', async ({
  page,
}) => {
  await openViewer(page)
  await page.getByRole('button', { name: 'Section', exact: true }).click()
  await page.getByRole('button', { name: 'Measure', exact: true }).click()
  await page.getByRole('button', { name: 'Explode', exact: true }).click()
  await page.getByRole('slider', { name: 'Explosion amount' }).fill('1')
  await expect(page.getByRole('group', { name: 'Section and measure options' })).toHaveCount(0)
  await expect(page.locator('p', { hasText: 'Cut:' })).toContainText('off')
  await expect(page.locator('p', { hasText: 'Measured:' })).toContainText('off')
  await page.getByRole('button', { name: 'Section', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Explode options' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Exit section', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Explode', exact: true }).click()
  await page.getByRole('slider', { name: 'Explosion amount' }).fill('0.5')
  await page.getByRole('button', { name: 'Measure', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Explode options' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Exit measure', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('changing parts resets the explode mode and its transient selection', async ({ page }) => {
  await openViewer(page)
  await page.getByRole('button', { name: 'Explode', exact: true }).click()
  await page.getByRole('slider', { name: 'Explosion amount' }).fill('1')
  await page.getByRole('combobox', { name: 'Model', exact: true }).selectOption('brick')
  await expect(page.getByRole('group', { name: 'Explode options' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Explode', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.locator('p', { hasText: 'Selected:' })).toContainText('none')
  await page.getByRole('button', { name: 'Explode', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Explosion amount' })).toHaveValue('1')
})

test('scrubbing to zero keeps the original mesh paintable when explode is closed', async ({
  page,
}) => {
  const { canvas, box } = await openViewer(page)
  await page.getByRole('button', { name: 'Explode', exact: true }).click()
  const amount = page.getByRole('slider', { name: 'Explosion amount' })
  await amount.fill('0')
  await page.getByRole('button', { name: 'Collapse', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Explode options' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Top view', exact: true }).click()
  await page.waitForTimeout(900)
  // Disable hover so only the selection can change the part's paint.
  await page.getByRole('button', { name: 'Disable feature hover', exact: true }).click()
  await page.mouse.move(0, 0)
  const unselected = await canvas.screenshot()
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } })
  await page.mouse.move(0, 0)
  await expect(page.locator('p', { hasText: 'Selected:' })).toContainText('front-face')
  await expect.poll(async () => Buffer.compare(unselected, await canvas.screenshot())).not.toBe(0)
})

test('Reset closes explode and restores the opening camera orientation and framing', async ({
  page,
}) => {
  await openViewer(page)
  const opening = await readCamera(page)
  await page.getByRole('button', { name: 'Top view', exact: true }).click()
  await page.getByRole('button', { name: 'Explode', exact: true }).click()
  await page.getByRole('slider', { name: 'Explosion amount' }).fill('1')
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Explode options' })).toHaveCount(0)
  await expect
    .poll(async () => (await readCamera(page)).position[0])
    .toBeCloseTo(opening.position[0], 1)
  await expect.poll(async () => (await readCamera(page)).distance).toBeCloseTo(opening.distance, 1)
})

test('defers hidden playback and resumes pending explode and collapse when visible', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let hidden = false
    Object.defineProperty(document, 'hidden', { get: () => hidden })
    Object.assign(window, {
      setExplosionHidden: (next: boolean) => {
        hidden = next
        document.dispatchEvent(new Event('visibilitychange'))
      },
    })
  })
  await openViewer(page, 'model=brick')
  const setHidden = (hidden: boolean) =>
    page.evaluate((next) => {
      ;(window as unknown as { setExplosionHidden: (hidden: boolean) => void }).setExplosionHidden(
        next,
      )
    }, hidden)
  await setHidden(true)
  await page.getByRole('button', { name: 'Explode', exact: true }).click()
  const amount = page.getByRole('slider', { name: 'Explosion amount' })
  await page.waitForTimeout(300)
  await expect(amount).toHaveValue('0')
  await setHidden(false)
  await expect(amount).toHaveValue('1')

  await amount.fill('0.6')
  await setHidden(true)
  await page.getByRole('button', { name: 'Collapse', exact: true }).click()
  await page.waitForTimeout(300)
  await expect(amount).toHaveValue('0.6')
  await setHidden(false)
  await expect(page.getByRole('group', { name: 'Explode options' })).toHaveCount(0)
})
