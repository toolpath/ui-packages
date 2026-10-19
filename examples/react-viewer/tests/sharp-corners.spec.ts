import { expect, test } from '@playwright/test'
import { openViewer } from './canvas.js'

/**
 * Sharp corners as a user meets them: one toolbar button, drawing the corners
 * of the features the DFM rules flag and nothing else.
 *
 * The lines are drawn with a patched copy of three's line shader, and a bad
 * patch shows up only as a console error on the first frame that draws one,
 * so this listens for the whole test, not only the mount `openViewer` checks.
 */
test("draws the flagged pocket's corners, and nothing on a part with none", async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await openViewer(page, 'model=sharp-pocket')
  const readout = page.getByTestId('sharp-corners')
  await expect(readout).toHaveAttribute('data-segments', '0')

  // The four up the pocket's walls, which no end mill makes. Not the four round
  // its floor, not the pocket's rim, not the block's outside edges.
  await page.getByRole('button', { name: 'Show sharp corners' }).click()
  await expect(readout).toHaveAttribute('data-segments', '4')
  await expect(page.locator('[data-viewer-tool-options]')).toHaveCount(0)

  // Holes, rims and outside edges are not sharp corners: the plate has none flagged.
  await page.getByRole('combobox', { name: /^Model/ }).selectOption({ label: 'Drilled plate' })
  await expect(readout).toHaveAttribute('data-segments', '0')

  await page
    .getByRole('combobox', { name: /^Model/ })
    .selectOption({ label: 'Square-cornered pocket' })
  await expect(readout).toHaveAttribute('data-segments', '4')
  await page.getByRole('button', { name: 'Hide sharp corners' }).click()
  await expect(readout).toHaveAttribute('data-segments', '0')

  await page.waitForTimeout(300)
  expect(errors, 'drawing the sharp corners logged errors').toEqual([])
})

/**
 * With feature hover on, the pointer on a sharp corner is on the corner: the
 * card says what it is, and a few pixels either side it is the face again.
 *
 * The camera is put where the pocket's one corner in view is near the middle
 * of the line swept — a three-quarter look from above, as the page's own Top
 * view and one drag leave it.
 */
test('hovering a sharp corner shows what it is', async ({ page }) => {
  await openViewer(page, 'model=sharp-pocket&sharp=on')
  await page.getByRole('button', { name: 'Enable feature hover' }).click()
  await page.getByRole('button', { name: 'Top view' }).click()
  await page.waitForTimeout(800)
  const canvas = await page.locator('canvas').boundingBox()
  if (!canvas) throw new Error('Viewer canvas has no bounding box')
  const [cx, cy] = [canvas.x + canvas.width / 2, canvas.y + canvas.height / 2]
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 80, cy + 120, { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(800)

  const viewer = await page.locator('.viewer').boundingBox()
  if (!viewer) throw new Error('Viewer has no bounding box')
  const card = page.locator('.viewer-hover-card')
  const under = async (dx: number) => {
    await page.mouse.move(viewer.x + 511 + dx, viewer.y + 448)
    await page.waitForTimeout(150)
    const text = (await card.textContent()) ?? ''
    return text.includes('Sharp corner') ? 'corner' : 'face'
  }

  const swept: string[] = []
  for (let dx = -16; dx <= 16; dx += 4) swept.push(await under(dx))

  // Face, then the corner, then face again.
  expect(swept[0]).toBe('face')
  expect(swept.at(-1)).toBe('face')
  expect(swept).toContain('corner')

  await under(swept.indexOf('corner') * 4 - 16)
  await expect(card).toContainText('Sharp corner')
  await expect(card).toContainText('Pocket')
  await expect(card).toContainText('90°')
  await expect(card).toContainText('8.00 mm')
})
