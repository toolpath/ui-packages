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
  position: readonly [number, number, number]
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
  const position = await readout.getAttribute('data-position')
  if (zoom === null || distance === null || target === null || position === null) {
    throw new Error('The example is not reporting its camera')
  }
  const [x, y, z] = target.split(' ').map(Number)
  const [positionX, positionY, positionZ] = position.split(' ').map(Number)
  return {
    zoom: Number(zoom),
    distance: Number(distance),
    target: [x, y, z],
    position: [positionX, positionY, positionZ],
  }
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

/** Where pixels of one colour sit on the canvas, in canvas-relative CSS pixels. */
export interface ColourPatch {
  /** How many pixels matched. */
  count: number
  /** Their centroid. */
  centre: { x: number; y: number }
  /** The unit direction they are most spread along. */
  axis: { x: number; y: number }
}

/**
 * Finds a solid shape of one shaded colour on the canvas: every pixel that is
 * the colour scaled by 0.7 to 1.05, which covers a lit control's light and
 * dark sides, to within `tolerance` per channel — and that is inside a patch
 * of them, rather than on a thin line of the same colour.
 *
 * The screenshot is decoded in the page itself, into a 2D canvas, so reading
 * pixels needs no image library here. Only the patch's summary comes back.
 * `mask` covers page elements laid over the canvas, such as the toolbar, so
 * their colours are not counted.
 */
export const findColour = async (
  page: Page,
  canvas: Locator,
  colour: number,
  { tolerance = 16, mask = [] }: { tolerance?: number; mask?: Locator[] } = {},
): Promise<ColourPatch> => {
  const png = (await canvas.screenshot({ mask })).toString('base64')
  return page.evaluate(
    async ({ png, colour, tolerance }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${png}`
      await image.decode()
      const surface = document.createElement('canvas')
      surface.width = image.width
      surface.height = image.height
      const context = surface.getContext('2d')
      if (!context) throw new Error('no 2D context to decode the screenshot in')
      context.drawImage(image, 0, 0)
      const { data } = context.getImageData(0, 0, image.width, image.height)

      const target = [(colour >> 16) & 0xff, (colour >> 8) & 0xff, colour & 0xff] as const
      const brightest = Math.max(...target)
      const lead = target.indexOf(brightest)
      const { width, height } = image
      const matches = new Uint8Array(width * height)
      for (let at = 0; at < matches.length; at += 1) {
        const pixel = [data[at * 4]!, data[at * 4 + 1]!, data[at * 4 + 2]!]
        const shade = pixel[lead]! / brightest
        if (shade < 0.7 || shade > 1.05) continue
        if (
          pixel.every((value, channel) => Math.abs(value - target[channel]! * shade) <= tolerance)
        ) {
          matches[at] = 1
        }
      }

      // Eroded: only pixels whose whole 3x3 neighbourhood matches. A line drawn
      // in the same colour is a pixel or two wide and goes; a solid shape stays.
      const points: Array<[number, number]> = []
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          let solid = true
          for (let dy = -1; dy <= 1 && solid; dy += 1) {
            for (let dx = -1; dx <= 1 && solid; dx += 1) {
              solid = matches[(y + dy) * width + x + dx] === 1
            }
          }
          if (solid) points.push([x, y])
        }
      }

      const count = points.length
      if (count === 0) return { count, centre: { x: 0, y: 0 }, axis: { x: 1, y: 0 } }
      const cx = points.reduce((sum, [x]) => sum + x, 0) / count
      const cy = points.reduce((sum, [, y]) => sum + y, 0) / count
      let xx = 0
      let xy = 0
      let yy = 0
      for (const [x, y] of points) {
        xx += (x - cx) ** 2
        xy += (x - cx) * (y - cy)
        yy += (y - cy) ** 2
      }
      // The principal axis of the patch's spread.
      const angle = 0.5 * Math.atan2(2 * xy, xx - yy)
      return { count, centre: { x: cx, y: cy }, axis: { x: Math.cos(angle), y: Math.sin(angle) } }
    },
    { png, colour, tolerance },
  )
}

/** A box on the canvas, in canvas-relative CSS pixels. */
export interface PixelBounds {
  count: number
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * The bounds of everything light on the canvas — the part, against the page's
 * dark background — leaving out page elements laid over it (`mask`) and any
 * regions given as fractions of the canvas (`ignore`), such as the view cube's
 * corner, which keeps its size whatever the camera does.
 */
export const brightBounds = async (
  page: Page,
  canvas: Locator,
  {
    mask = [],
    ignore = [],
    threshold = 150,
  }: {
    mask?: Locator[]
    ignore?: Array<{ left: number; top: number; right: number; bottom: number }>
    threshold?: number
  } = {},
): Promise<PixelBounds> => {
  const png = (await canvas.screenshot({ mask })).toString('base64')
  return page.evaluate(
    async ({ png, ignore, threshold }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${png}`
      await image.decode()
      const surface = document.createElement('canvas')
      surface.width = image.width
      surface.height = image.height
      const context = surface.getContext('2d')
      if (!context) throw new Error('no 2D context to decode the screenshot in')
      context.drawImage(image, 0, 0)
      const { data } = context.getImageData(0, 0, image.width, image.height)

      const bounds = {
        count: 0,
        left: Infinity,
        top: Infinity,
        right: -Infinity,
        bottom: -Infinity,
      }
      for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
          const fx = x / image.width
          const fy = y / image.height
          if (ignore.some((r) => fx >= r.left && fx <= r.right && fy >= r.top && fy <= r.bottom)) {
            continue
          }
          const at = (y * image.width + x) * 4
          // Rec. 709 luma; masked elements are painted magenta, which stays under it.
          const luma = 0.2126 * data[at]! + 0.7152 * data[at + 1]! + 0.0722 * data[at + 2]!
          if (luma < threshold) continue
          bounds.count += 1
          bounds.left = Math.min(bounds.left, x)
          bounds.top = Math.min(bounds.top, y)
          bounds.right = Math.max(bounds.right, x)
          bounds.bottom = Math.max(bounds.bottom, y)
        }
      }
      return bounds
    },
    { png, ignore, threshold },
  )
}
