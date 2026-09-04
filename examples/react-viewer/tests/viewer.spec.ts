import { expect, test } from '@playwright/test'
import { at, on, openViewer } from './canvas.js'

/**
 * The example viewer, driven the way somebody would drive it.
 *
 * **The click points are found, not chosen.** They were scanned off the
 * rendered canvas; the comment beside each says what it hits, and the first
 * test below is the guard that says so out loud.
 *
 * They depend on the **viewer build**, not only on the projection this example
 * asks for — a camera change inside `@toolpath/viewer` moves them just as a
 * different `projection` prop would. That is not hypothetical: making
 * orthographic the package default moved every one of them, and two of the four
 * tests here went red reporting "Direction: never left all" and "expected
 * back-face, got bottom-face", neither of which names a camera. This page of
 * the example therefore asks for `projection="perspective"` (`src/main.tsx`)
 * and the guard names the points, so the next such change reports itself once.
 *
 * The package's own default is exercised on the other page —
 * `?projection=orthographic`, in `tests/orthographic.spec.ts`, with click points
 * scanned under that camera.
 *
 * Fractions of the canvas rather than pixels (`./canvas.ts`): the canvas is laid
 * out beside the text column and is not the same shape on every machine that
 * runs this, while the part is framed against the canvas it is given.
 */
/** On the part, dead centre — the back face under this camera. */
const CENTRE = { x: 0.5, y: 0.5 }
/** On the part, above centre — a *different* face from `OTHER`. */
const ONE = { x: 0.5, y: 0.32 }
/** On the part, below centre. */
const OTHER = { x: 0.5, y: 0.62 }
/**
 * On the first direction arrow, which floats clear of the part's corner. The
 * part is behind it, so a click that misses the arrow lands on a face — which
 * is what makes "the selection did not change" a real assertion about it.
 */
const ARROW = { x: 0.33, y: 0.27 }

/**
 * What each point hits, named.
 *
 * Nothing checked this before, so a camera that moved was reported by whichever
 * assertions happened to depend on a coordinate — seven of them in the sibling
 * DFM template, four sentences each, none of them saying "the camera moved".
 * This test says it in one, and it fails first because it is first in the file.
 */
test('the click points hit the faces the rest of this file is written about', async ({ page }) => {
  const { canvas, box } = await openViewer(page)

  const selected = page.locator('p', { hasText: 'Selected:' })
  const direction = page.locator('p', { hasText: 'Direction:' })

  await canvas.click({ position: on(box, CENTRE) })
  await expect(selected).toContainText('back-face')

  await canvas.click({ position: on(box, ONE) })
  await expect(selected).toContainText('right-face')

  await canvas.click({ position: on(box, OTHER) })
  await expect(selected).toContainText('back-face')

  // ONE and OTHER being *different* faces is what the drag-versus-click test
  // rests on; that they are these two is what everything else rests on.
  expect(ONE).not.toEqual(OTHER)

  // The arrow is on top of the part, so it has to take the click itself. If it
  // has moved off the arrow the selection changes and the direction does not,
  // which is exactly the pair of symptoms Phase 6 produced.
  const before = await selected.textContent()
  await page.mouse.click(at(box, ARROW).x, at(box, ARROW).y)
  await expect(direction).toContainText('0')
  await expect(selected).toHaveText(before ?? '')
})

test('selects a feature and responds to CAD camera navigation', async ({ page }) => {
  const { canvas, box } = await openViewer(page)

  // The section. Driven through its slider rather than by dragging the handle
  // in the viewport: the handle is a dozen pixels across, its position depends
  // on the canvas size, and a drag over software WebGL on CI is slow enough to
  // outlast the timeout. The drag's own maths are unit tested; what this covers
  // is that a cut happens and reports itself.
  const cut = page.locator('p', { hasText: 'Cut:' })
  await page.getByRole('button', { name: 'Section' }).click()
  await expect(cut).toContainText('45%')
  await page.getByRole('slider').fill('0.8')
  await expect(cut).toContainText('80%')
  await page.getByRole('button', { name: 'Section' }).click()
  await expect(cut).toContainText('off')

  await canvas.hover({ position: on(box, CENTRE) })
  await expect(page.getByText('Hovered:', { exact: false })).not.toContainText('none')

  await canvas.click({ position: on(box, CENTRE) })
  await expect(page.getByText('Selected:', { exact: false })).not.toContainText('none')

  // An arrow says "show me only this way up", and pressing it again lets that
  // go. The arrows sit outside the part, so this reaches past its corner.
  const direction = page.locator('p', { hasText: 'Direction:' })
  await expect(direction).toContainText('all')
  const arrow = at(box, ARROW)
  await page.mouse.click(arrow.x, arrow.y)
  await expect(direction).not.toContainText('all')
  await page.mouse.click(arrow.x, arrow.y)
  await expect(direction).toContainText('all')

  const beforeOrbit = await canvas.screenshot()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60)
  await page.mouse.up()
  await expect.poll(async () => Buffer.compare(beforeOrbit, await canvas.screenshot())).not.toBe(0)

  const afterOrbit = await canvas.screenshot()
  await page.getByRole('button', { name: 'Top view' }).click()
  await expect.poll(async () => Buffer.compare(afterOrbit, await canvas.screenshot())).not.toBe(0)

  // The orientation cube sits in the top-right corner and drives the camera
  // through the same path the buttons do. Clicking its centre from the top view
  // hits the TOP panel; clicking below its centre hits a chamfer, which is an
  // edge view and must move the camera.
  const cube = { x: box.width - 80, y: 80 }
  const beforeCube = await canvas.screenshot()
  const selected = await page.getByText('Selected:', { exact: false }).textContent()
  await canvas.click({ position: { x: cube.x, y: cube.y + 34 } })
  await expect.poll(async () => Buffer.compare(beforeCube, await canvas.screenshot())).not.toBe(0)
  // Moving the camera is not picking a feature: if this click had fallen
  // through to the part, the selection would have changed with it.
  await expect(page.getByText('Selected:', { exact: false })).toHaveText(selected ?? '')
})

test('pans with either pan button, from wherever the drag starts', async ({ page }) => {
  const { canvas, box } = await openViewer(page)

  // The <p>, not the <strong> inside it: `getByText('Selected:')` matches the
  // label alone, whose text never changes, so every assertion below would hold
  // whatever the viewer did.
  const selected = page.locator('p', { hasText: 'Selected:' })
  const centre = on(box, CENTRE)

  // The gesture starts in the bottom-left corner: empty, as far from the part
  // as the viewport gets, and clear of the toolbar in the top-left. A pan that
  // needs the pointer over the part is a pan that stops working on exactly the
  // view somebody was trying to fix.
  const panFromCorner = async (button: 'right' | 'middle') => {
    const from = { x: box.x + 40, y: box.y + box.height - 40 }
    await page.mouse.move(from.x, from.y)
    await page.mouse.down({ button })
    for (let step = 1; step <= 10; step += 1) {
      await page.mouse.move(from.x + step * (box.width * 0.15), from.y)
    }
    await page.mouse.up({ button })
    await page.waitForTimeout(300)
  }

  for (const button of ['right', 'middle'] as const) {
    await page.getByRole('button', { name: 'Fit' }).click()
    await page.waitForTimeout(300)
    await canvas.click({ position: centre })
    await expect(selected).not.toContainText('none')

    await panFromCorner(button)

    // The part has left the middle of the view, which a pan does and an orbit
    // does not: an orbit turns the part about that point and leaves it there.
    // Clicking where it was now hits nothing, which is what puts the selection
    // down.
    await canvas.click({ position: centre })
    await expect(selected).toContainText('none')
  }
})

test('finishing a drag over a face is not a request to select it', async ({ page }) => {
  const { canvas, box } = await openViewer(page)

  const selected = page.locator('p', { hasText: 'Selected:' })
  const hovered = page.locator('p', { hasText: 'Hovered:' })
  // Two points on two different faces of the cube — see the guard above.
  const one = on(box, ONE)
  const other = on(box, OTHER)

  await canvas.click({ position: one })
  await expect(selected).not.toContainText('none')
  const chosen = await selected.textContent()

  // Press on the *other* face and orbit a little. The gesture ends over a face
  // that is not the selected one, which is what the browser calls a click.
  await page.mouse.move(box.x + other.x, box.y + other.y)
  await page.mouse.down()
  for (let step = 1; step <= 6; step += 1) {
    await page.mouse.move(box.x + other.x + step * 4, box.y + other.y + step * 2)
  }
  await page.mouse.up()
  await page.waitForTimeout(250)

  // It really is a different face under the pointer, or this test would hold
  // whatever the code did.
  await expect(hovered).not.toContainText('none')
  expect(await hovered.textContent()).not.toBe((chosen ?? '').replace('Selected:', 'Hovered:'))

  // The selection is what the orbit was made to look at. Taking it away is
  // taking away the reason for the gesture.
  await expect(selected).toHaveText(chosen ?? '')

  // A click still selects: the guard is about the drag, not about having
  // dragged recently.
  await canvas.click({ position: other })
  await expect(selected).toContainText('back-face')
})

/**
 * Panning is not a request to put the selection down.
 *
 * R3F counts `contextmenu` as a click, and the browser sends that the instant
 * the right button goes down — before any movement — so the selection went the
 * moment a pan began, whatever the pan did next.
 */
test('panning over empty space keeps the selection', async ({ page }) => {
  const { canvas, box } = await openViewer(page)

  const selected = page.locator('p', { hasText: 'Selected:' })
  await canvas.click({ position: on(box, ONE) })
  await expect(selected).not.toContainText('none')
  const chosen = await selected.textContent()

  // Right-drag well away from the part, where nothing is hit.
  const from = { x: box.x + 40, y: box.y + box.height - 40 }
  await page.mouse.move(from.x, from.y)
  await page.mouse.down({ button: 'right' })
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(from.x + step * 20, from.y - step * 5)
  }
  await page.mouse.up({ button: 'right' })
  await page.waitForTimeout(250)

  await expect(selected).toHaveText(chosen ?? '')

  // Even a right-click that does not move: the button says what it means, and
  // it never means "deselect".
  await page.mouse.click(box.x + 60, box.y + 60, { button: 'right' })
  await expect(selected).toHaveText(chosen ?? '')
})

/**
 * A pan is not half of a double click.
 *
 * The middle button is TRUCK, so *every* middle-button pan ends in an
 * `auxclick` — the same event the double-middle-click re-frame is assembled
 * from. Unguarded, two pans released near enough to each other in time and
 * space paired into a double and called Fit, throwing away the pan just made.
 * The left button has had this guard on the mesh all along; this is the middle
 * one getting it too.
 */
test('two middle-button pans released in the same place do not re-frame', async ({ page }) => {
  const { canvas, box } = await openViewer(page)

  const selected = page.locator('p', { hasText: 'Selected:' })
  const centre = on(box, CENTRE)

  await page.getByRole('button', { name: 'Fit' }).click()
  await page.waitForTimeout(300)
  await canvas.click({ position: centre })
  await expect(selected).not.toContainText('none')

  // Both pans finish at the same pixel, back to back: the release points are
  // well inside the slop and the pair is well inside the window, which is
  // exactly what the double-tap tracker is looking for. They travel the same
  // way, so the part is further off centre after the second, not back where it
  // started.
  const release = { x: box.x + box.width * 0.7, y: box.y + box.height - 40 }
  const panTo = async (startX: number) => {
    await page.mouse.move(startX, release.y)
    await page.mouse.down({ button: 'middle' })
    for (let step = 1; step <= 4; step += 1) {
      await page.mouse.move(startX + ((release.x - startX) * step) / 4, release.y)
    }
    await page.mouse.up({ button: 'middle' })
  }

  await panTo(box.x + box.width * 0.1)
  await panTo(box.x + box.width * 0.4)
  await page.waitForTimeout(300)

  // The part is off centre and stayed there. A re-frame would have put it back
  // under the middle of the canvas, and this click would have found it.
  await canvas.click({ position: centre })
  await expect(selected).toContainText('none')
})
