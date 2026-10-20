import { expect, test, type CDPSession, type Page } from '@playwright/test'
import { brightBounds, openViewer, type CanvasBox } from './canvas.js'

/**
 * Touch, as a phone's browser delivers it: real touch events through the
 * DevTools protocol, which Chromium turns into touch pointer events the way
 * it does for a finger. Chromium only — the protocol is Chromium's.
 */
test.skip(({ browserName }) => browserName !== 'chromium', 'touch is dispatched through CDP')

type Point = { x: number; y: number }

const touches = async (session: CDPSession, type: string, points: Point[]) => {
  await session.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((point, id) => ({ x: point.x, y: point.y, id })),
  })
}

/** Moves every finger from `from` to `to` in even steps. */
const glide = async (session: CDPSession, page: Page, from: Point[], to: Point[], steps = 12) => {
  await touches(session, 'touchStart', from)
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps
    await touches(
      session,
      'touchMove',
      from.map((start, index) => ({
        x: start.x + (to[index]!.x - start.x) * t,
        y: start.y + (to[index]!.y - start.y) * t,
      })),
    )
    await page.waitForTimeout(16)
  }
  await touches(session, 'touchEnd', [])
}

const middle = (box: CanvasBox): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })

/** The overlays laid over the canvas, and the view cube's corner, which a zoom does not resize. */
const outside = (page: Page) => ({
  mask: [
    page.locator('[data-viewer-toolbar]'),
    page.getByRole('group', { name: 'Section and measure options', exact: true }),
  ],
  ignore: [{ left: 0.75, top: 0, right: 1, bottom: 0.3 }],
})

test('one finger orbits the part and selects nothing', async ({ page }) => {
  const { canvas, box } = await openViewer(page)
  const session = await page.context().newCDPSession(page)
  const selected = page.locator('p', { hasText: 'Selected:' })
  const selection = await selected.textContent()
  const before = await canvas.screenshot()

  const start = middle(box)
  await glide(session, page, [start], [{ x: start.x + 160, y: start.y + 40 }])

  await expect.poll(async () => Buffer.compare(before, await canvas.screenshot())).not.toBe(0)
  await expect(selected).toHaveText(selection ?? '')
})

test('a pinch zooms the orthographic camera in', async ({ page }) => {
  const { canvas, box } = await openViewer(page, 'projection=orthographic')
  const session = await page.context().newCDPSession(page)
  const before = await brightBounds(page, canvas, outside(page))
  expect(before.count, 'the part is on screen').toBeGreaterThan(1000)

  const { x, y } = middle(box)
  await glide(
    session,
    page,
    [
      { x: x - 40, y },
      { x: x + 40, y },
    ],
    [
      { x: x - 160, y },
      { x: x + 160, y },
    ],
  )
  await page.waitForTimeout(300)

  const after = await brightBounds(page, canvas, outside(page))
  const width = (bounds: typeof before) => bounds.right - bounds.left
  const height = (bounds: typeof before) => bounds.bottom - bounds.top
  expect(Math.max(width(after) / width(before), height(after) / height(before))).toBeGreaterThan(
    1.2,
  )
})
