import { expect, test } from '@playwright/test'
import { at, findColour, on, openViewer, readCamera } from './canvas.js'

/** On the part, dead centre — the back face under this page's camera (`viewer.spec.ts`). */
const CENTRE = { x: 0.5, y: 0.5 }

/** Beside the part, where a press reaches nothing but the camera controls. */
const EMPTY = { x: 0.12, y: 0.6 }

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

/**
 * A drag the system cancels still hands the view back.
 *
 * The handle switches the camera controls off while it is dragged, and only
 * its own release or a cancel turns them on again. A finger's touch is
 * cancelled mid-drag here, as a phone does for a gesture of its own, so no
 * release ever reaches the handle, and the drag that follows on empty canvas
 * has to orbit as usual. Touch goes through the DevTools protocol, so this is
 * Chromium only.
 */
test('a cancelled handle drag leaves the view free to turn', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'touch is dispatched through CDP')
  const { canvas, box } = await openViewer(page)
  const session = await page.context().newCDPSession(page)
  const finger = (type: string, point?: { x: number; y: number }) =>
    session.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: point ? [{ x: point.x, y: point.y, id: 0 }] : [],
    })

  await page.getByRole('button', { name: 'Section' }).click()
  await canvas.click({ position: on(box, CENTRE) })
  await expect(page.locator('p', { hasText: 'Cut:' })).toContainText('Part surface')

  await page.mouse.move(box.x + box.width + 20, box.y + box.height / 2)
  const handle = await findColour(page, canvas, Z_HANDLE, {
    mask: [
      page.locator('[data-viewer-toolbar]'),
      page.getByRole('group', { name: 'Section and measure options', exact: true }),
    ],
  })
  expect(handle.count, 'the section handle is on screen').toBeGreaterThan(50)

  const along = handle.axis.y < 0 ? -1 : 1
  const from = { x: box.x + handle.centre.x, y: box.y + handle.centre.y }
  const cut = page.locator('p', { hasText: 'Cut:' })
  const depth = await cut.textContent()
  await finger('touchStart', from)
  for (let step = 1; step <= 6; step += 1) {
    await finger('touchMove', {
      x: from.x + along * handle.axis.x * 8 * step,
      y: from.y + along * handle.axis.y * 8 * step,
    })
  }
  await expect(cut, 'the finger is dragging the handle').not.toHaveText(depth ?? '')
  await finger('touchCancel')

  const before = await readCamera(page)
  const start = at(box, EMPTY)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 120, start.y, { steps: 8 })
  await page.mouse.up()

  await expect
    .poll(async () => (await readCamera(page)).position, 'the drag turned the view')
    .not.toEqual(before.position)
})
