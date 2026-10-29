import { readFile } from 'node:fs/promises'
import { expect, test, type Route } from '@playwright/test'

const fixture = new URL('../../../packages/viewer/fixtures/', import.meta.url)
const report = JSON.parse(await readFile(new URL('reports/local-0.3.0-cube.json', fixture), 'utf8'))
const mesh = await readFile(new URL('mesh/local-0.3.0-cube.glb', fixture))

/**
 * `usePartCollection` driving a `PartCollection`: every body appears together,
 * a body's new model loads while its current mesh stays drawn, the mesh it
 * replaces is freed, and unmounting frees the rest without an error.
 */
test('loads every body, swaps in a new model once it loads, and frees meshes', async ({ page }) => {
  const errors: Array<string> = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/collection-test-report.json', (route) =>
    route.fulfill({ json: { ...report, thumbnailUrl: null } }),
  )
  // The analysis mesh is held until the test lets it through.
  let held: Route | null = null
  await page.route('**/collection-test/*.glb', (route) => {
    if (route.request().url().endsWith('/analysis.glb')) {
      held = route
      return
    }
    return route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: mesh })
  })
  await page.goto('/tests/fixtures/use-part-collection.html')

  await expect(page.getByTestId('items')).toHaveText('left right')
  await expect(page.getByTestId('drawn')).toHaveText('left right')
  await expect(page.getByTestId('waiting')).toHaveText('')

  await page.getByRole('button', { name: 'Analyse' }).click()
  await expect.poll(() => held !== null).toBe(true)
  await expect(page.getByTestId('waiting')).toHaveText('right')
  await expect(page.getByTestId('items')).toHaveText('left right')
  await expect(page.getByTestId('drawn')).toHaveText('left right')
  await held!.fulfill({ status: 200, contentType: 'model/gltf-binary', body: mesh })
  await expect(page.getByTestId('items')).toHaveText('left analysis')
  await expect(page.getByTestId('drawn')).toHaveText('analysis left')
  await expect(page.getByTestId('waiting')).toHaveText('')
  await expect(page.getByTestId('disposed')).toHaveText('right')

  await page.getByRole('button', { name: 'Unmount' }).click()
  await expect(page.getByTestId('disposed')).toHaveText('analysis left right')
  expect(errors).toEqual([])
})
