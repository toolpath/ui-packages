import { expect, test } from '@playwright/test'
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
