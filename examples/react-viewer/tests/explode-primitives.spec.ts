import { expect, test } from '@playwright/test'

test('the public primitive renders caller-defined repeated surfaces, picks source coordinates, and stays within its draw budget', async ({
  page,
}) => {
  const errors: Array<string> = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/tests/fixtures/explode-primitives.html')
  await expect(page.getByTestId('ready')).toHaveText('true')
  await expect(page.getByTestId('warmups')).toHaveText('1')
  await expect(page.getByTestId('draws')).toHaveText('4')
  const canvas = page.locator('canvas')
  for (const [id, x, worldX] of [
    ['left-piece', 295, -35],
    ['right-piece', 535, 45],
  ] as const) {
    await canvas.click({ position: { x, y: 279 } })
    await expect
      .poll(async () => JSON.parse((await page.getByTestId('pick').textContent())!).explodeGroupId)
      .toBe(id)
    const pick = JSON.parse((await page.getByTestId('pick').textContent())!)
    expect(pick.owners).toEqual([])
    expect(pick.best).toBeNull()
    expect(pick.modelPoint[0]).toBeCloseTo(0)
    expect(pick.modelPoint[1]).toBeCloseTo(0)
    expect(pick.modelPoint[2]).toBeCloseTo(12.7)
    expect(pick.point[0]).toBeCloseTo(worldX)
    expect(pick.point[1]).toBeCloseTo(7)
    expect(pick.point[2]).toBeCloseTo(15.7)
    await expect(page.getByTestId('hover')).toHaveText(id)
    await expect(page.getByTestId('draws')).toHaveText('7')
  }
  await page.getByRole('button', { name: 'Recolor', exact: true }).click()
  await expect
    .poll(async () => JSON.parse((await page.getByTestId('pick').textContent())!).explodeGroupId)
    .toBe('right-piece')
  await page.getByRole('slider', { name: 'Amount', exact: true }).fill('0.5')
  await canvas.click({ position: { x: 475, y: 279 } })
  const half = JSON.parse((await page.getByTestId('pick').textContent())!)
  expect(half.explodeGroupId).toBe('right-piece')
  expect(half.point[0]).toBeCloseTo(25)
  expect(half.modelPoint[0]).toBeCloseTo(0)
  // The source ghost and selected source highlight never steal a pick.
  await canvas.click({ position: { x: 415, y: 279 } })
  await expect
    .poll(async () => JSON.parse((await page.getByTestId('pick').textContent())!).explodeGroupId)
    .toBe('right-piece')
  await page.getByRole('button', { name: 'Toggle visibility', exact: true }).click()
  await expect(page.getByTestId('draws')).toHaveText('0')
  await canvas.click({ position: { x: 355, y: 279 } })
  await expect
    .poll(async () => JSON.parse((await page.getByTestId('pick').textContent())!).explodeGroupId)
    .toBe('right-piece')
  await page.getByRole('button', { name: 'Toggle visibility', exact: true }).click()
  await expect(page.getByTestId('draws')).toHaveText('7')
  await expect(page.getByTestId('warmups')).toHaveText('1')
  await page.getByRole('button', { name: 'Toggle empty', exact: true }).click()
  await expect(page.getByTestId('draws')).toHaveText('0')
  await page.getByRole('button', { name: 'Toggle empty', exact: true }).click()
  await expect(page.getByTestId('draws')).toHaveText('7')
  await expect(page.getByTestId('warmups')).toHaveText('2')
  await expect(page.getByTestId('source-disposals')).toHaveText('0')
  expect(errors).toEqual([])
})
