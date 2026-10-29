import { expect, test, type Page } from '@playwright/test'
test('a complete collection scopes duplicate feature tags, hover, and sections to the correct bodies', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/collection.html')
  await expect
    .poll(
      async () => JSON.parse((await page.getByTestId('scene').textContent()) || '{}').width ?? 0,
    )
    .toBeGreaterThan(70)
  await page.getByRole('button', { name: 'Top', exact: true }).click()
  const canvas = page.locator('canvas')
  const picks: Array<{ id: string; pick: { best: string } }> = []
  for (const index of [0, 1]) {
    const scene = JSON.parse((await page.getByTestId('scene').textContent())!)
    await canvas.click({ position: scene.centers[index] })
    await expect
      .poll(async () => JSON.parse((await page.getByTestId('pick').textContent())!).id)
      .toBe(index === 0 ? 'left' : 'right')
    picks.push(JSON.parse((await page.getByTestId('pick').textContent())!))
    await expect(page.getByTestId('hover')).toHaveText(index === 0 ? 'left' : 'right')
  }
  expect(picks[0]!.pick.best).toBe(picks[1]!.pick.best)
  await page.getByRole('button', { name: 'Cut', exact: true }).click()
  await expect
    .poll(async () => Object.keys(JSON.parse((await page.getByTestId('cuts').textContent())!)))
    .toHaveLength(2)
  const cuts = JSON.parse((await page.getByTestId('cuts').textContent())!)
  expect(cuts.left).toBe(cuts.right)
  // One cap over both bodies, not one stacked per body.
  await expect
    .poll(async () => JSON.parse((await page.getByTestId('scene').textContent())!).caps)
    .toBe(1)
})
test('overlapping opaque bodies pick the nearest body once, with either button', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/collection.html')
  await expect(page.getByTestId('scene')).not.toHaveText('')
  await page.getByRole('button', { name: 'Top', exact: true }).click()
  await page.getByRole('button', { name: 'Overlap', exact: true }).click()
  const scene = JSON.parse((await page.getByTestId('scene').textContent())!)
  const picks = async () => JSON.parse((await page.getByTestId('picks').textContent())!)
  await page.locator('canvas').click({ position: scene.centers[0] })
  await expect.poll(picks).toEqual(['right'])
  await page.locator('canvas').click({ position: scene.centers[0], button: 'right' })
  await expect.poll(picks).toEqual(['right', 'right'])
  expect(JSON.parse((await page.getByTestId('pick').textContent())!).pick.modifiers.secondary).toBe(
    true,
  )
})
test('moving onto a body in front of the hovered one hovers the body in front', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/collection.html')
  await expect(page.getByTestId('scene')).not.toHaveText('')
  await page.getByRole('button', { name: 'Top', exact: true }).click()
  await page.getByRole('button', { name: 'Stagger', exact: true }).click()
  const scene = JSON.parse((await page.getByTestId('scene').textContent())!)
  const canvas = page.locator('canvas')
  await canvas.hover({ position: scene.alone })
  await expect(page.getByTestId('hover')).toHaveText('left')
  // One move, which reports the body behind as left before the body in front as entered.
  await canvas.hover({ position: scene.covered })
  await expect(page.getByTestId('hover')).toHaveText('right')
})
test('a see-through body draws over the one behind it and still takes the pointer', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/collection.html')
  await expect(page.getByTestId('scene')).not.toHaveText('')
  await page.getByRole('button', { name: 'Top', exact: true }).click()
  await page.getByRole('button', { name: 'Stagger', exact: true }).click()
  await page.getByRole('button', { name: 'Ghost', exact: true }).click()
  await expect
    .poll(async () => JSON.parse((await page.getByTestId('scene').textContent())!).ghosts)
    .toBe(1)
  const scene = JSON.parse((await page.getByTestId('scene').textContent())!)
  await page.locator('canvas').hover({ position: scene.covered })
  await expect(page.getByTestId('hover')).toHaveText('right')
})

/** The share of a square patch of the canvas, centred on `at`, that is red. */
const redShare = async (page: Page, at: { x: number; y: number }) => {
  const png = (await page.locator('canvas').screenshot()).toString('base64')
  return page.evaluate(
    async ({ png, at }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${png}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      // Screenshot pixels are device pixels; `at` is in CSS pixels.
      const scale = image.width / document.querySelector('canvas')!.clientWidth
      const side = Math.round(30 * scale)
      const { data } = context.getImageData(
        Math.round(at.x * scale) - side / 2,
        Math.round(at.y * scale) - side / 2,
        side,
        side,
      )
      let red = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i]! > 150 && data[i + 1]! < 110 && data[i + 2]! < 110) red++
      }
      return red / (data.length / 4)
    },
    { png, at },
  )
}
test('bodies that lie on one another draw one surface, in list order, not a mix of both', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/collection.html')
  await expect(page.getByTestId('scene')).not.toHaveText('')
  await page.getByRole('button', { name: 'Top', exact: true }).click()
  await page.getByRole('button', { name: 'Stack', exact: true }).click()
  await page.getByRole('button', { name: 'Tint', exact: true }).click()
  const scene = JSON.parse((await page.getByTestId('scene').textContent())!)
  // The red body is second in the list, so the first is drawn where they coincide.
  await expect.poll(() => redShare(page, scene.centers[0])).toBe(0)
  await page.getByRole('button', { name: 'Raise', exact: true }).click()
  await expect.poll(() => redShare(page, scene.centers[0])).toBe(1)
})
test('a hidden body in front lets the body behind it take the pointer', async ({ page }) => {
  await page.goto('/tests/fixtures/collection.html')
  await expect(page.getByTestId('scene')).not.toHaveText('')
  await page.getByRole('button', { name: 'Top', exact: true }).click()
  await page.getByRole('button', { name: 'Stagger', exact: true }).click()
  const scene = JSON.parse((await page.getByTestId('scene').textContent())!)
  const canvas = page.locator('canvas')
  await canvas.hover({ position: scene.covered })
  await expect(page.getByTestId('hover')).toHaveText('right')
  await page.getByRole('button', { name: 'Hide', exact: true }).click()
  await canvas.hover({ position: scene.alone })
  await canvas.hover({ position: scene.covered })
  await expect(page.getByTestId('hover')).toHaveText('left')
  await canvas.click({ position: scene.covered })
  await expect
    .poll(async () => JSON.parse((await page.getByTestId('picks').textContent())!))
    .toEqual(['left'])
})
test('an exploded body moves with its picks, and the shared bounds hold it apart', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/collection.html')
  await expect(page.getByTestId('scene')).not.toHaveText('')
  await page.getByRole('button', { name: 'Overlap', exact: true }).click()
  const scene = async () => JSON.parse((await page.getByTestId('scene').textContent())!)
  await expect.poll(async () => (await scene()).width).toBeLessThan(70)
  const assembled = (await scene()).width
  await page.getByRole('button', { name: 'Top', exact: true }).click()
  await page.getByRole('button', { name: 'Explode', exact: true }).click()
  await expect.poll(async () => (await scene()).width).toBeCloseTo(assembled + 70)
  const picks = async () => JSON.parse((await page.getByTestId('picks').textContent())!)
  const canvas = page.locator('canvas')
  // At amount 0 the right body still lies over the left one.
  await canvas.click({ position: (await scene()).centers[0] })
  await expect.poll(picks).toEqual(['right'])
  // Set outside React: the next frame moves it, and the left body takes the pointer.
  await page.getByRole('button', { name: 'Apart', exact: true }).click()
  await canvas.click({ position: (await scene()).centers[0] })
  await expect.poll(picks).toEqual(['right', 'left'])
  // Framed again, the moved body is in view where it now is.
  await page.getByRole('button', { name: 'Top', exact: true }).click()
  await expect
    .poll(async () => {
      const { x, y } = (await scene()).centers[1]
      return x > 0 && x < 800 && y > 0 && y < 600
    })
    .toBe(true)
  await canvas.click({ position: (await scene()).centers[1] })
  await expect.poll(picks).toEqual(['right', 'left', 'right'])
})
/** The mean colour of a square patch of the canvas, centred on `at`. */
const meanColour = async (page: Page, at: { x: number; y: number }) => {
  const png = (await page.locator('canvas').screenshot()).toString('base64')
  return page.evaluate(
    async ({ png, at }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${png}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      const scale = image.width / document.querySelector('canvas')!.clientWidth
      const side = Math.round(30 * scale)
      const { data } = context.getImageData(
        Math.round(at.x * scale) - side / 2,
        Math.round(at.y * scale) - side / 2,
        side,
        side,
      )
      const sum = [0, 0, 0]
      for (let i = 0; i < data.length; i += 4) {
        for (const channel of [0, 1, 2]) sum[channel]! += data[i + channel]!
      }
      return sum.map((total) => total / (data.length / 4))
    },
    { png, at },
  )
}
test('the section cap follows an exploded body', async ({ page }) => {
  await page.goto('/tests/fixtures/collection.html')
  await expect(page.getByTestId('scene')).not.toHaveText('')
  await page.getByRole('button', { name: 'Explode', exact: true }).click()
  await page.getByRole('button', { name: 'Apart', exact: true }).click()
  await page.getByRole('button', { name: 'Cut', exact: true }).click()
  // The cut keeps the upper half, so the cap faces down.
  await page.getByRole('button', { name: 'Bottom', exact: true }).click()
  const scene = async () => JSON.parse((await page.getByTestId('scene').textContent())!)
  await expect
    .poll(async () => {
      const { x, y } = (await scene()).centers[2]
      return x > 0 && x < 800 && y > 0 && y < 600
    })
    .toBe(true)
  await expect.poll(async () => (await scene()).caps).toBe(1)
  // The moved body's cut is capped as the body left in place is, not open onto its inside.
  const { centers } = await scene()
  await expect
    .poll(async () => {
      const [still, moved] = [
        await meanColour(page, centers[0]),
        await meanColour(page, centers[2]),
      ]
      return Math.max(...still.map((value, channel) => Math.abs(value - moved[channel]!)))
    })
    .toBeLessThan(12)
})
