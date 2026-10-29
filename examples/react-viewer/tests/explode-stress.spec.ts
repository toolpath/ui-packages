import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { readCamera } from './canvas'

// Opt in with a cad-viewer sample directory. No CAD files are retained here.
const sampleDir = process.env.VIEWER_STRESS_SAMPLE_DIR
test.skip(!sampleDir, 'Set VIEWER_STRESS_SAMPLE_DIR to an offline analysis.json + mesh.glb pair.')
// Full Chromium uses the host GPU where available; the headless shell uses
// software rendering on macOS and cannot represent interactive frame rates.
test.use({ channel: 'chromium', viewport: { width: 1500, height: 1000 } })
test.setTimeout(90_000)

const files = async () => [
  {
    name: 'analysis.json',
    mimeType: 'application/json',
    buffer: await readFile(join(sampleDir!, 'analysis.json')),
  },
  {
    name: 'mesh.glb',
    mimeType: 'model/gltf-binary',
    buffer: await readFile(join(sampleDir!, 'mesh.glb')),
  },
]

const camera = async (page: Page) => {
  const pose = await readCamera(page)
  return [pose.zoom, pose.distance, ...pose.target, ...pose.position].map((v) =>
    Number(v.toFixed(5)),
  )
}

test('the real dense sample clears the source and preserves feature membership', async ({
  page,
}) => {
  const [analysis, mesh] = await files()
  await page.route('**/explode-stress-analysis.json', (route) =>
    route.fulfill({ body: analysis.buffer, contentType: analysis.mimeType }),
  )
  await page.route('**/explode-stress-mesh.glb', (route) =>
    route.fulfill({ body: mesh.buffer, contentType: mesh.mimeType }),
  )
  await page.goto('/tests/fixtures/explode-policy.html?stress=1')
  const output = page.getByTestId('policy-results')
  await expect(output).toBeVisible()
  const { stress } = JSON.parse((await output.textContent())!)
  expect(stress.features).toBeGreaterThanOrEqual(300)
  expect(stress.unchanged).toBe(true)
  expect(stress.layouts[0].groups).toBeGreaterThanOrEqual(300)
  for (const layout of stress.layouts) {
    expect(layout.renderable).toBe(true)
    expect(layout.allClear).toBe(true)
    expect(layout.stable).toBe(true)
    expect(layout.samePieces).toBe(true)
    expect(layout.featureIdentity).toBe(true)
  }
  expect(stress.layouts[1].groups).toBe(stress.layouts[0].groups)
  expect(stress.layouts[1].triangles).toBe(stress.layouts[0].triangles)
})

test('the real dense sample animates, recolors individual features, picks, collapses, and reopens', async ({
  page,
}) => {
  const errors: Array<string> = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })
  // Full Chromium requests an icon automatically; this example has no icon asset.
  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204 }))
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles(await files())
  await expect(page.getByRole('combobox', { name: 'Model', exact: true })).toHaveValue('opened-1')
  await expect(page.getByRole('button', { name: 'Explode', exact: true })).toBeEnabled()
  await page.waitForTimeout(800)
  const opening = await camera(page)
  await page.getByRole('button', { name: 'Explode', exact: true }).click()
  const amount = page.getByRole('slider', { name: 'Explosion amount' })
  await expect(amount).toHaveValue('1', { timeout: 30_000 })
  expect(await camera(page)).toEqual(opening)
  await page.getByRole('button', { name: 'Fit', exact: true }).click()
  await page.waitForTimeout(1500)
  const fitted = await camera(page)
  const canvas = page.locator('canvas')
  const box = (await canvas.boundingBox())!
  const selection = page.locator('p', { hasText: 'Selected:' })
  const pickSurface = async () => {
    for (const y of [0.5, 0.35, 0.65, 0.25, 0.75]) {
      for (const x of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
        await canvas.click({ position: { x: box.width * x, y: box.height * y } })
        if ((await selection.innerText()) !== 'Selected: none') {
          return true
        }
      }
    }
    return false
  }
  expect(await pickSurface(), 'an exploded surface accepts a real canvas pick').toBe(true)
  const pickedFeature = await selection.innerText()
  await amount.fill('0.45')
  await page.getByRole('button', { name: 'Direction', exact: true }).click()
  await expect(amount).toHaveValue('0.45')
  await expect(selection).toHaveText(pickedFeature)
  await page.getByRole('button', { name: 'Feature', exact: true }).click()
  await expect(amount).toHaveValue('0.45')
  await expect(selection).toHaveText(pickedFeature)
  expect(await camera(page)).toEqual(fitted)
  for (let cycle = 0; cycle < 2; cycle += 1) {
    await page.getByRole('button', { name: 'Collapse', exact: true }).click()
    await expect(page.getByRole('group', { name: 'Explode options', exact: true })).toHaveCount(0, {
      timeout: 30_000,
    })
    expect(await camera(page)).toEqual(fitted)
    expect(await pickSurface(), 'the assembled mesh accepts picks after collapse').toBe(true)
    await page.getByRole('button', { name: 'Explode', exact: true }).click()
    await expect(amount).toHaveValue('1', { timeout: 30_000 })
    expect(await camera(page)).toEqual(fitted)
  }
  expect(errors).toEqual([])
})
