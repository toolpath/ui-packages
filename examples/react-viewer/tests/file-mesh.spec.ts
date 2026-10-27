import { expect, test } from '@playwright/test'

test('a file’s mesh draws each body it holds, by index, until nothing draws them', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/file-mesh.html')
  // Body 1 is not in the mesh; bodies 0 and 2 are drawn, 35 mm either side of the origin.
  await expect(page.getByTestId('ids')).toHaveText('body-0 body-2')
  await expect
    .poll(async () => JSON.parse((await page.getByTestId('scene').textContent()) || '{}').width)
    .toBe(95)
  const fetched = async () =>
    page.evaluate(() => (window as unknown as { fileMeshFetches: Array<string> }).fileMeshFetches)
  const first = await fetched()
  expect(first.every((url) => url.endsWith('?signature=1'))).toBe(true)

  const scene = JSON.parse((await page.getByTestId('scene').textContent())!)
  await page.locator('canvas').click({ position: scene.centers[1] })
  await expect(page.getByTestId('pick')).toHaveText('body-2')

  // A new presign for the same mesh is the same mesh.
  await page.getByRole('button', { name: 'Refresh URL', exact: true }).click()
  await expect(page.getByTestId('ids')).toHaveText('body-0 body-2')
  expect(await fetched()).toEqual(first)
  await expect(page.getByTestId('disposed')).toHaveText('0')

  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByTestId('disposed')).toHaveText('2')
})
