import { expect, test } from '@playwright/test'

test('replacing a prepared layout redraws a demand canvas without camera input or app invalidation', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/explode-primitives.html')
  await expect(page.getByTestId('ready')).toHaveText('true')
  const canvas = page.locator('canvas')
  await page.mouse.move(0, 0)
  const before = await canvas.screenshot()
  await page.getByRole('button', { name: 'Replace layout', exact: true }).click()
  await expect(page.locator('#warm-phase')).toHaveText('prepared')
  await expect.poll(async () => Buffer.compare(before, await canvas.screenshot())).toBe(0)
})

test('theme changes repaint the public primitive without allocating buffers or losing selection', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const counts = { buffers: 0, programs: 0 }
    Object.assign(window, { __explodeThemeCounts: counts })
    const prototype = WebGL2RenderingContext.prototype
    const createBuffer = prototype.createBuffer
    const createProgram = prototype.createProgram
    prototype.createBuffer = function () {
      counts.buffers += 1
      return createBuffer.call(this)
    }
    prototype.createProgram = function () {
      counts.programs += 1
      return createProgram.call(this)
    }
  })
  await page.goto('/tests/fixtures/explode-primitives.html')
  await expect(page.getByTestId('ready')).toHaveText('true')
  const canvas = page.locator('canvas')
  await canvas.click({ position: { x: 535, y: 279 } })
  await page.mouse.move(0, 0)
  const before = await canvas.screenshot()
  const readCounts = () =>
    page.evaluate(
      () =>
        (window as unknown as { __explodeThemeCounts: { buffers: number; programs: number } })
          .__explodeThemeCounts,
    )
  const counts = await readCounts()
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click()
  await expect.poll(async () => Buffer.compare(before, await canvas.screenshot())).not.toBe(0)
  await expect(page.getByTestId('warmups')).toHaveText('1')
  expect(await readCounts()).toEqual(counts)
  await canvas.click({ position: { x: 535, y: 279 } })
  const pick = JSON.parse((await page.getByTestId('pick').textContent())!)
  expect(pick.explodeGroupId).toBe('right-piece')
  expect(pick.modelPoint[0]).toBeCloseTo(0)
  await page.getByRole('slider', { name: 'Amount', exact: true }).fill('0.5')
  await page.getByRole('button', { name: 'Toggle theme', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Amount', exact: true })).toHaveValue('0.5')
  await expect(page.getByTestId('warmups')).toHaveText('1')
  expect(await readCounts()).toEqual(counts)
})

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

test('controller updates and region paint redraw an idle demand canvas without replacing buffers or warming shaders', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const counts = { buffers: 0, programs: 0 }
    Object.assign(window, { __explodeCounts: counts })
    const prototype = WebGL2RenderingContext.prototype
    const buffer = prototype.createBuffer
    const program = prototype.createProgram
    prototype.createBuffer = function () {
      counts.buffers += 1
      return buffer.call(this)
    }
    prototype.createProgram = function () {
      counts.programs += 1
      return program.call(this)
    }
  })
  await page.goto('/tests/fixtures/explode-primitives.html')
  await expect(page.getByTestId('ready')).toHaveText('true')
  const canvas = page.locator('canvas')
  const readCounts = () =>
    page.evaluate(
      () =>
        (window as unknown as { __explodeCounts: { buffers: number; programs: number } })
          .__explodeCounts,
    )
  await page.getByRole('button', { name: 'Toggle controller', exact: true }).click()
  await page.mouse.move(0, 0)
  const before = await canvas.screenshot()
  const counts = await readCounts()
  await page.getByRole('button', { name: 'Controller half', exact: true }).click()
  await expect.poll(async () => Buffer.compare(before, await canvas.screenshot())).not.toBe(0)
  await canvas.click({ position: { x: 475, y: 279 } })
  let pick = JSON.parse((await page.getByTestId('pick').textContent())!)
  expect(pick.explodeGroupId).toBe('right-piece')
  expect(pick.modelPoint[0]).toBeCloseTo(0)
  await page.mouse.move(0, 0)
  const half = await canvas.screenshot()
  await page.getByRole('button', { name: 'Region paint', exact: true }).click()
  await expect.poll(async () => Buffer.compare(half, await canvas.screenshot())).not.toBe(0)
  await page.getByRole('button', { name: 'Controller full', exact: true }).click()
  await canvas.click({ position: { x: 535, y: 279 } })
  pick = JSON.parse((await page.getByTestId('pick').textContent())!)
  expect(pick.explodeGroupId).toBe('right-piece')
  expect(pick.point[0]).toBeCloseTo(45)
  await expect(page.getByTestId('warmups')).toHaveText('1')
  // Selection uploads its preallocated source indices on first use; no new GPU buffers/programs.
  expect(await readCounts()).toEqual(counts)
  await page.getByRole('button', { name: 'Toggle controller', exact: true }).click()
  const numeric = await canvas.screenshot()
  await page.getByRole('button', { name: 'Controller half', exact: true }).click()
  await expect.poll(async () => Buffer.compare(numeric, await canvas.screenshot())).toBe(0)
})
