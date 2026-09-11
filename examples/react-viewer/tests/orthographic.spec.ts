import { expect, test } from '@playwright/test'
import { ORIGIN, at, expectPivot, on, openViewer, readCamera, type Fraction } from './canvas.js'

/*
 * The package's own numbers, copied rather than imported.
 *
 * Importing `@toolpath/viewer` here runs it in Playwright's node process, where
 * its `CameraControls.install` call has no browser to install against and
 * throws before a single test is collected. So these are transcribed, and named
 * after the constants they belong to: `DOUBLE_TAP_MS` and `ORBIT_TARGET_FADE_MS`
 * in `packages/viewer/src/render/tap.ts` and `render/target.ts`. A change to
 * either shows up here as a test that stops making sense rather than as one
 * that goes red, which is why both are used inside an assertion that says what
 * they mean.
 */
const DOUBLE_TAP_MS = 400
const ORBIT_TARGET_FADE_MS = 1000

/**
 * The camera the package ships, and the two gestures that arrived with it.
 *
 * `tests/viewer.spec.ts` drives the example's default page, which pins a
 * perspective camera so its hand-scanned click points hold still. That left the
 * projection `@toolpath/viewer` actually defaults to — orthographic — with no
 * browser coverage at all, along with `retargetOnDoubleClick` (on by default)
 * and `showOrbitTarget`. This file is the other page: `?projection=orthographic`
 * (`src/main.tsx`), with click points of its own.
 *
 * They were scanned off the rendered canvas under this camera and no other. The
 * orthographic start direction is not the perspective one, so none of the
 * sibling file's points carry over, and the guard below is what says out loud
 * which face each of these lands on.
 */
const ORTHOGRAPHIC = 'projection=orthographic'

/** Dead centre — the `front-face` (+Z) under this camera. */
const CENTRE: Fraction = { x: 0.5, y: 0.5 }
/** Right of centre and below it — the `right-face` (+X). */
const RIGHT: Fraction = { x: 0.65, y: 0.6 }
/** Left of centre and below it — the `bottom-face` (-Y). */
const LOW: Fraction = { x: 0.38, y: 0.62 }

/** The plane the `right-face` lies in: half of the 25.4 mm cube. */
const RIGHT_FACE_X = 12.7

test('the orthographic click points hit the faces the rest of this file is written about', async ({
  page,
}) => {
  const { canvas, box } = await openViewer(page, ORTHOGRAPHIC)

  // First, because everything below is written about a camera rather than about
  // a URL: if the query string stopped selecting the projection, every other
  // test here would quietly re-test the perspective page and pass.
  await expect(page.locator('p', { hasText: 'Projection:' })).toContainText('orthographic')

  const selected = page.locator('p', { hasText: 'Selected:' })

  await canvas.click({ position: on(box, CENTRE) })
  await expect(selected).toContainText('front-face')

  await canvas.click({ position: on(box, RIGHT) })
  await expect(selected).toContainText('right-face')

  await canvas.click({ position: on(box, LOW) })
  await expect(selected).toContainText('bottom-face')

  // The opening pose, which the re-target tests below measure against: the
  // pivot is the middle of the part, and an orthographic Fit is `zoom` 1.
  const pose = await readCamera(page)
  expectPivot(pose, ORIGIN)
  expect(pose.zoom).toBeCloseTo(1, 5)
})

/**
 * Double left click on a face orbits about that face from then on.
 *
 * On by default, and under an orthographic camera it is the only gesture that
 * re-aims the pivot at all — the wheel there scales a frustum rather than
 * travelling toward anything.
 */
test('a double click on a face aims the orbit at the point that was clicked', async ({ page }) => {
  const { canvas, box } = await openViewer(page, ORTHOGRAPHIC)

  expectPivot(await readCamera(page), ORIGIN)

  await canvas.dblclick({ position: on(box, RIGHT) })
  await expect(page.locator('p', { hasText: 'Selected:' })).toContainText('right-face')

  // The pivot is on the face that was clicked, not merely somewhere new: the
  // `right-face` is the plane x = 12.7, and the other two axes are inside the
  // cube's extent.
  //
  // Polled rather than read once. The readout is painted from a frame, and the
  // frame the re-target asks for has to run before the page can say where the
  // pivot went.
  await expect.poll(async () => (await readCamera(page)).target[0]).toBeCloseTo(RIGHT_FACE_X, 3)
  const pose = await readCamera(page)
  expect(Math.abs(pose.target[1])).toBeLessThan(RIGHT_FACE_X)
  expect(Math.abs(pose.target[2])).toBeLessThan(RIGHT_FACE_X)

  // And the view moved with it, which is the half a consumer sees: the clicked
  // point is now the middle of the canvas, so the middle of the canvas is over
  // the face that was clicked. It was the `front-face` before.
  await canvas.hover({ position: on(box, CENTRE) })
  await expect(page.locator('p', { hasText: 'Hovered:' })).toContainText('right-face')
})

/**
 * An orbit released over the part is not half of a double click.
 *
 * The part is one mesh, so an orbit that ends over it is still a `click` as far
 * as the browser is concerned, and an orbit over a part that fills the viewport
 * never leaves the mesh for `onPointerOut` to notice. Left unreset, the click
 * before the orbit and the click after it paired — with a whole drag in
 * between — and the view re-aimed at a face nobody had double-clicked.
 */
test('an orbit released over the part does not pair with the click after it', async ({ page }) => {
  const { canvas, box } = await openViewer(page, ORTHOGRAPHIC)

  const selected = page.locator('p', { hasText: 'Selected:' })
  const point = at(box, RIGHT)

  /*
   * The first click on the part costs more than every one after it: the pick
   * walks the region index for the first time, and the highlight repaint writes
   * the layer texture for the first time. Left inside the sequence below, that
   * cost falls between the two clicks being paired — it spends the very budget
   * under test, and on a loaded runner it can outrun the window on its own.
   * Spent here instead, on a face far enough away that it cannot pair with what
   * follows.
   */
  await canvas.click({ position: on(box, CENTRE) })
  await expect(selected).toContainText('front-face')

  /*
   * Timed on the page's clock rather than this process's, because that is the
   * clock being judged: pairing compares one `click` event's `timeStamp` with
   * the last. Timing the Playwright calls instead puts a protocol round trip
   * per gesture — six of them — inside a budget that belongs to the browser.
   */
  await page.evaluate(() => {
    const clicks: number[] = []
    ;(window as unknown as { clickTimes: number[] }).clickTimes = clicks
    addEventListener('click', (event) => clicks.push(event.timeStamp), { capture: true })
  })

  // All three gestures inside the double-tap window, or the pair this is about
  // could not form in the first place and the test would pass on the clock.
  // Every event in here renders a frame, so the sequence is as short as the
  // gesture allows: a click, one drag of 20 px released back where the click
  // was, and a second click.
  await page.mouse.click(point.x, point.y)
  await page.mouse.move(point.x + 14, point.y + 14)
  await page.mouse.down()
  await page.mouse.move(point.x, point.y)
  await page.mouse.up()
  await page.mouse.click(point.x, point.y)

  const clicks = await page.evaluate(
    () => (window as unknown as { clickTimes: number[] }).clickTimes,
  )

  await expect(selected).toContainText('right-face')
  expect(clicks, 'the sequence did not reach the page as a click, a drag and a click').toHaveLength(
    3,
  )
  expect(
    clicks[2] - clicks[0],
    'the three gestures outran the double-tap window, so this run proved nothing',
  ).toBeLessThan(DOUBLE_TAP_MS)

  // The orbit moved the camera; nothing in the sequence asked the pivot to
  // move, and a pair would have put it on the face that was clicked. The wait
  // is for the frame that would have shown it doing so.
  await page.waitForTimeout(300)
  expectPivot(await readCamera(page), ORIGIN)
})

/**
 * The pivot marker, which is off unless asked for.
 *
 * Both halves matter: a viewer that grew a dot in the middle of every
 * screenshot would be a surprise to anybody already rendering with this, and a
 * marker that never appears is the prop doing nothing.
 *
 * Pressed over empty space and released without moving, so the camera never
 * moves and the selection never changes — every pixel that differs between the
 * two frames is the marker. The `off` page is the control that says so.
 */
for (const orbitTarget of ['on', 'off'] as const) {
  test(`the orbit marker is up during a gesture and gone after it (orbitTarget=${orbitTarget})`, async ({
    page,
  }) => {
    const { canvas, box } = await openViewer(page, `${ORTHOGRAPHIC}&orbitTarget=${orbitTarget}`)

    // Empty canvas, as far from the part as the viewport gets and clear of the
    // toolbar in the top-left corner.
    const empty = { x: box.x + 40, y: box.y + box.height - 40 }
    const before = await readCamera(page)

    await page.mouse.move(empty.x, empty.y)
    await page.mouse.down()
    const held = await canvas.screenshot()
    await page.mouse.up()
    await page.waitForTimeout(ORBIT_TARGET_FADE_MS + 400)
    const faded = await canvas.screenshot()

    // Nothing about the view changed across the gesture, so the marker is the
    // only thing either frame can differ by.
    //
    // To six decimals rather than exactly: the controls re-derive the pose from
    // a damped update every frame, so a camera standing perfectly still still
    // walks the last bit or two of its mantissa. A move worth catching here is
    // millimetres.
    const after = await readCamera(page)
    expect(after.zoom).toBeCloseTo(before.zoom, 6)
    expect(after.distance).toBeCloseTo(before.distance, 6)
    expect(after.target[0]).toBeCloseTo(before.target[0], 6)
    expect(after.target[1]).toBeCloseTo(before.target[1], 6)
    expect(after.target[2]).toBeCloseTo(before.target[2], 6)
    // And the fade has finished, rather than being caught mid-step.
    expect(Buffer.compare(faded, await canvas.screenshot())).toBe(0)

    const changed = Buffer.compare(held, faded) !== 0
    expect(changed).toBe(orbitTarget === 'on')
  })
}
