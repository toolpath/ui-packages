import { expect, test } from '@playwright/test'
import { findColour, on, openViewer } from './canvas.js'

/** On the part, dead centre — the back face under this page's camera (`viewer.spec.ts`). */
const CENTRE = { x: 0.5, y: 0.5 }

/**
 * The handle's colour for the cut a click at {@link CENTRE} makes, as drawn:
 * its plane's direction colour, which for that face's Z normal is the Z axis
 * colour (`AXIS_COLORS.z`, `0x6f9bff`), through the arrow's light and the
 * renderer's tone mapping.
 */
const Z_HANDLE = 0x89abe2

/**
 * Dragging the section handle moves the cut and nothing else.
 *
 * `viewer.spec.ts` moves the cut with the slider; this is the drag itself. The
 * handle is found on the screenshot by its colour rather than at a fixed
 * point, since where it lands depends on the canvas size, and dragged along
 * its own length, the way it points.
 */
test('dragging the section handle moves the cut without changing the selection', async ({
  page,
}) => {
  const { canvas, box } = await openViewer(page)
  const cut = page.locator('p', { hasText: 'Cut:' })
  const selected = page.locator('p', { hasText: 'Selected:' })

  await page.getByRole('button', { name: 'Section' }).click()
  await canvas.click({ position: on(box, CENTRE) })
  await expect(cut).toContainText('Part surface')
  const slider = page.getByRole('slider', { name: 'Cut depth' })
  const before = await slider.inputValue()
  const depth = await cut.textContent()
  const selection = await selected.textContent()

  // Off the canvas, so the handle is not drawn in its hover colour.
  await page.mouse.move(box.x + box.width + 20, box.y + box.height / 2)
  await page.waitForTimeout(200)
  const handle = await findColour(page, canvas, Z_HANDLE, {
    mask: [
      page.locator('[data-viewer-toolbar]'),
      page.getByRole('group', { name: 'Section and measure options', exact: true }),
    ],
  })
  expect(handle.count, 'the section handle is on screen').toBeGreaterThan(50)

  // The arrow points out of the material, toward the top of the view under
  // this camera, and the cut starts at the face: outward it has nowhere to go.
  // So the drag runs along the arrow toward the bottom of the view, into the part.
  const along = handle.axis.y < 0 ? -1 : 1
  const from = { x: box.x + handle.centre.x, y: box.y + handle.centre.y }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + along * handle.axis.x * 80, from.y + along * handle.axis.y * 80, {
    steps: 16,
  })
  await page.mouse.up()

  await expect(cut).not.toHaveText(depth ?? '')
  await expect(slider).not.toHaveValue(before)
  await expect(cut).toContainText('Part surface')
  await expect(selected).toHaveText(selection ?? '')
})
