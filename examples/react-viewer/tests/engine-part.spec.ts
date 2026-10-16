import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const fixture = new URL('../../../packages/viewer/fixtures/', import.meta.url)
const report = JSON.parse(await readFile(new URL('reports/local-0.3.0-cube.json', fixture), 'utf8'))
const mesh = await readFile(new URL('mesh/local-0.3.0-cube.glb', fixture))

const openFailingPart = async (page: Page) => {
  const requests: Array<string> = []
  let allowOriginal = false
  await page.route('**/engine-test-report.json', (route) =>
    route.fulfill({
      json: {
        ...report,
        meshGlbUrl: '/engine-test.glb?signature=expired',
        meshStlUrl: '/engine-test.stl?signature=expired',
        thumbnailUrl: null,
      },
    }),
  )
  await page.route('**/engine-test.*', (route) => {
    const url = new URL(route.request().url())
    requests.push(url.pathname + url.search)
    return url.searchParams.get('signature') === 'renewed' || allowOriginal
      ? route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: mesh })
      : route.fulfill({ status: 403, body: 'Expired signature' })
  })
  await page.goto('/tests/fixtures/engine-part.html')
  return { requests, allowOriginal: () => (allowOriginal = true) }
}

test('failed GLB and STL downloads reach the error boundary without a request loop', async ({
  page,
}) => {
  const { requests } = await openFailingPart(page)

  await expect(page.getByRole('alert')).toHaveText('Could not load the part mesh.')
  await expect(page.getByRole('status')).toHaveCount(0)
  // Observe after the fallback commits: a restarted Suspense load would request again.
  await page.waitForTimeout(500)
  expect(requests).toEqual([
    '/engine-test.glb?signature=expired',
    '/engine-test.stl?signature=expired',
  ])
})

test('fresh signed URLs recover a failed artifact with the same path', async ({ page }) => {
  const { requests } = await openFailingPart(page)
  await expect(page.getByRole('alert')).toBeVisible()

  await page.getByRole('button', { name: 'Refresh URLs' }).click()
  await expect(page.getByTestId('mesh-ready')).toHaveText('ready')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(requests).toEqual([
    '/engine-test.glb?signature=expired',
    '/engine-test.stl?signature=expired',
    '/engine-test.glb?signature=renewed',
  ])
})

test('an explicit retry can use the original URLs after the failure is resolved', async ({
  page,
}) => {
  const { requests, allowOriginal } = await openFailingPart(page)
  await expect(page.getByRole('alert')).toBeVisible()

  allowOriginal()
  await page.getByRole('button', { name: 'Retry same URLs' }).click()
  await expect(page.getByTestId('mesh-ready')).toHaveText('ready')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(requests).toEqual([
    '/engine-test.glb?signature=expired',
    '/engine-test.stl?signature=expired',
    '/engine-test.glb?signature=expired',
  ])
})
