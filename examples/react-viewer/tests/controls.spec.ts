import { expect, test, type Page } from '@playwright/test'
import { at, openViewer, readCamera } from './canvas.js'

const centre = { x: 0.5, y: 0.5 }

const drag = async (
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
  button: 'left' | 'middle' | 'right',
) => {
  await page.mouse.move(start.x, start.y)
  await page.mouse.down({ button })
  await page.mouse.move(end.x, end.y, { steps: 8 })
  await page.mouse.up({ button })
  await page.waitForTimeout(100)
}

test('Toolpath and Onshape assign orbit and pan to their documented mouse buttons', async ({
  page,
}) => {
  const toolpath = await openViewer(page, 'controls=toolpath')
  await expect(page.getByText('Controls: toolpath')).toBeVisible()
  const toolpathBefore = await readCamera(page)
  await drag(page, at(toolpath.box, centre), at(toolpath.box, { x: 0.62, y: 0.5 }), 'left')
  const toolpathAfter = await readCamera(page)
  expect(toolpathAfter.position).not.toEqual(toolpathBefore.position)
  expect(toolpathBefore.target).toEqual(toolpathAfter.target)

  await page.getByLabel('3D controls').selectOption('onshape')
  await expect(page.getByText('Controls: onshape')).toBeVisible()
  const onshapeBefore = await readCamera(page)
  await drag(page, at(toolpath.box, centre), at(toolpath.box, { x: 0.62, y: 0.5 }), 'middle')
  const onshapeAfter = await readCamera(page)
  expect(onshapeAfter.target).not.toEqual(onshapeBefore.target)
})

test('Fusion and SolidWorks apply their modifier-aware middle-button controls', async ({
  page,
}) => {
  const fusion = await openViewer(page, 'controls=fusion')
  const fusionBefore = await readCamera(page)
  await drag(page, at(fusion.box, centre), at(fusion.box, { x: 0.62, y: 0.5 }), 'middle')
  const fusionAfter = await readCamera(page)
  expect(fusionAfter.target).not.toEqual(fusionBefore.target)

  await page.getByLabel('3D controls').selectOption('solidworks')
  await expect(page.getByText('Controls: solidworks')).toBeVisible()
  const solidworksBefore = await readCamera(page)
  await page.keyboard.down('Control')
  await drag(page, at(fusion.box, centre), at(fusion.box, { x: 0.62, y: 0.5 }), 'middle')
  await page.keyboard.up('Control')
  const solidworksAfter = await readCamera(page)
  expect(solidworksAfter.target).not.toEqual(solidworksBefore.target)
})
