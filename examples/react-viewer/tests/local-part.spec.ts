import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const fixture = new URL('../../../packages/viewer/fixtures/', import.meta.url)
const report = JSON.parse(await readFile(new URL('reports/local-0.3.0-cube.json', fixture), 'utf8'))
const mesh = await readFile(new URL('mesh/local-0.3.0-cube.glb', fixture))

for (const snapshot of [false, true]) {
  test(`opens a local ${snapshot ? 'offline snapshot' : 'Engine report'} with its matching mesh and datasheets`, async ({
    page,
  }) => {
    const featureTag = report.features[0].featureTag
    const datasheets = [{ featureTag, datasheet: {} }]
    const json = snapshot
      ? { filename: 'Local cube.step', report, datasheets: { [featureTag]: {} } }
      : report
    await page.goto('/')
    const input = page.locator('input[type="file"]')
    await input.setInputFiles([
      {
        name: 'analysis.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(json)),
      },
      { name: 'mesh.glb', mimeType: 'model/gltf-binary', buffer: mesh },
      ...(snapshot
        ? []
        : [
            {
              name: 'datasheets.json',
              mimeType: 'application/json',
              buffer: Buffer.from(JSON.stringify({ datasheets })),
            },
          ]),
    ])
    await expect(page.getByRole('combobox', { name: 'Model', exact: true })).toHaveValue('opened-1')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      snapshot ? 'Local cube' : `Part ${report.partId.slice(0, 8)}`,
    )
    await expect(page.locator('p', { hasText: 'Opened from' })).toContainText('1 datasheets')
    await expect(page.getByRole('button', { name: 'Explode', exact: true })).toBeEnabled()
  })
}
