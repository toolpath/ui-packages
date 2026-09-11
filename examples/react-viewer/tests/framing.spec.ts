import { expect, test } from '@playwright/test'
import { openViewer, readCamera } from './canvas.js'

/**
 * How far in the wheel may push, as a multiple of the fitted framing, when
 * nothing has widened the band — `MAX_FRAME_RATIO` in
 * `packages/viewer/src/render/camera.ts`.
 *
 * Transcribed rather than imported: importing the package here runs it in
 * Playwright's node process, where its `CameraControls.install` call throws
 * before any test is collected.
 */
const MAX_FRAME_RATIO = 10

/**
 * Framing one small feature, and then resizing the window.
 *
 * `frameBox` widens the band the wheel may travel in to take in whatever it
 * framed — without that, framing a 2 mm detail in a 25.4 mm cube asks for about
 * 13x and silently gets the plain 10x cap. The widening is derived from the
 * bounds, and it is re-derived on every viewport change: a window drag, a panel
 * opening, a sidebar toggle. Re-derived from the scene alone it went back to
 * the unwidened band, and because `camera-controls` clamps at its call sites
 * rather than in `update()`, nothing moved until the **next wheel notch** —
 * which then snapped an orthographic zoom back to 10x, and dollied a
 * perspective camera outward, against the gesture.
 *
 * So the shape of the test is the shape of the bug: frame, resize, one notch
 * in. Both projections, because the two cameras carry the clamp in different
 * units and each half failed on its own terms.
 */
for (const projection of ['orthographic', 'perspective'] as const) {
  test(`a framed detail survives a resize (${projection})`, async ({ page }) => {
    const { canvas, box } = await openViewer(page, `projection=${projection}`)
    const fitted = await readCamera(page)

    await page.getByRole('button', { name: 'Frame detail' }).click()

    // The framing reached past the band the scene alone allows, or the resize
    // could not undo anything and the rest of this proves nothing. Under an
    // orthographic camera that is the zoom; under a perspective one it is the
    // distance, which `minDistance` would otherwise hold at a tenth of the
    // fitted one.
    //
    // Polled, because the readout is painted from a frame: this waits for the
    // framing to land and asserts what it landed on in one step.
    if (projection === 'orthographic') {
      await expect.poll(async () => (await readCamera(page)).zoom).toBeGreaterThan(MAX_FRAME_RATIO)
    } else {
      await expect
        .poll(async () => (await readCamera(page)).distance)
        .toBeLessThan(fitted.distance / MAX_FRAME_RATIO)
    }
    const framed = await readCamera(page)

    await page.setViewportSize({ width: 1160, height: 700 })
    await page.waitForTimeout(300)
    const resized = await canvas.boundingBox()
    if (!resized) throw new Error('Viewer canvas has no bounding box')
    // The canvas really did change shape — this is the event the limits are
    // re-derived from.
    expect(resized.width).not.toBe(box.width)

    // A resize moves nothing by itself: the clamps are applied at the call
    // sites, so a narrowed band sits there until a gesture meets it.
    const held = await readCamera(page)
    expect(held.zoom).toBeCloseTo(framed.zoom, 5)
    expect(held.distance).toBeCloseTo(framed.distance, 5)

    // One notch in, at the middle of the canvas.
    await page.mouse.move(resized.x + resized.width / 2, resized.y + resized.height / 2)
    await page.mouse.wheel(0, -120)

    // In means in. The regression this covers moved the view the other way —
    // and it moved it to a clamp and stopped, so polling cannot rescue it.
    if (projection === 'orthographic') {
      await expect.poll(async () => (await readCamera(page)).zoom).toBeGreaterThan(framed.zoom)
    } else {
      await expect.poll(async () => (await readCamera(page)).distance).toBeLessThan(framed.distance)
    }
  })
}
