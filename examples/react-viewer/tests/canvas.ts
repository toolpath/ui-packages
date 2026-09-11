import { expect, type Locator, type Page } from '@playwright/test'

/** A point on the canvas as a fraction of its width and height. */
export interface Fraction {
  x: number
  y: number
}

export interface CanvasBox {
  x: number
  y: number
  width: number
  height: number
}

/** Canvas-relative, for `locator.click({ position })`. */
export const on = (box: { width: number; height: number }, point: Fraction) => ({
  x: box.width * point.x,
  y: box.height * point.y,
})

/** Page-absolute, for `page.mouse`. */
export const at = (box: CanvasBox, point: Fraction) => ({
  x: box.x + box.width * point.x,
  y: box.y + box.height * point.y,
})

/**
 * Everything the page writes to the console, and everything it throws.
 *
 * Attached before the navigation, because what this is here for is raised on the
 * opening frame — a listener added after `goto` has already missed it.
 */
const recordErrors = (page: Page): string[] => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

/**
 * Opens the example and hands back the canvas once it has been framed.
 *
 * The wait is measured after the opening frame: before it, the canvas is still
 * at its default 300x150 and every coordinate taken from it would be wrong.
 *
 * `query` selects which page of the example this is — see `src/main.tsx`. The
 * default one pins a perspective camera; `projection=orthographic` is the
 * camera the package itself defaults to.
 *
 * **It also asserts the mount was clean**, which is why every spec here opens
 * through it. A viewport can look completely right and still be wrong: geometry
 * sized from a scene that has not been measured yet lands on a plane at
 * infinity, and three.js reports that by logging "Computed radius is NaN"
 * rather than by drawing anything a screenshot or a click point would catch.
 * Every other assertion in this suite reads pixels or the camera readout, so
 * without this the whole class is invisible here — on both pages, since the two
 * cameras mount the same overlays.
 *
 * The bar is *any* console error, not only three.js's. This is the example, and
 * a clean mount of it has nothing to say.
 */
export const openViewer = async (
  page: Page,
  query = '',
): Promise<{ canvas: Locator; box: CanvasBox }> => {
  const errors = recordErrors(page)

  await page.goto(query ? `/?${query}` : '/')
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(700)
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Viewer canvas has no bounding box')

  expect(errors, 'the viewer mounted with console errors').toEqual([])

  return { canvas, box }
}

/** Where the camera is, read off the example's own per-frame readout. */
export interface CameraPose {
  zoom: number
  distance: number
  target: readonly [number, number, number]
}

/**
 * The camera as numbers rather than as pixels.
 *
 * A screenshot says "something moved". The clamp regressions these tests are
 * here for are "it moved the wrong way" — a zoom that snapped back to its
 * unwidened cap, a dolly that went outward under a zoom-in — and telling those
 * from the correct move needs the number, not the picture.
 */
export const readCamera = async (page: Page): Promise<CameraPose> => {
  const readout = page.getByTestId('camera')
  const zoom = await readout.getAttribute('data-zoom')
  const distance = await readout.getAttribute('data-distance')
  const target = await readout.getAttribute('data-target')
  if (zoom === null || distance === null || target === null) {
    throw new Error('The example is not reporting its camera')
  }
  const [x, y, z] = target.split(' ').map(Number)
  return { zoom: Number(zoom), distance: Number(distance), target: [x, y, z] }
}

/**
 * Where the pivot is, to a tolerance a real move is nowhere near.
 *
 * Not exact equality: the controls re-derive the pose from a damped update
 * every frame, so a camera standing perfectly still still walks the last bit or
 * two of its mantissa. Six decimals is a millionth of a millimetre — the moves
 * these tests are about are millimetres.
 */
export const expectPivot = (
  pose: CameraPose,
  expected: readonly [number, number, number],
  digits = 6,
) => {
  expect(pose.target[0]).toBeCloseTo(expected[0], digits)
  expect(pose.target[1]).toBeCloseTo(expected[1], digits)
  expect(pose.target[2]).toBeCloseTo(expected[2], digits)
}

/** The middle of the part, which is where the pivot starts. */
export const ORIGIN = [0, 0, 0] as const
