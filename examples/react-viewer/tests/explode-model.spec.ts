import { expect, test } from '@playwright/test'

// Easing, reversal, scrubbing and paused tabs are the package's: see
// packages/viewer/tests/explode-motion.test.ts.

test('keeps feature layout stable and clears inner walls', async ({ page }) => {
  await page.goto('/tests/fixtures/explode-policy.html')
  const output = page.getByTestId('policy-results')
  await expect(output).toBeVisible()
  const report = JSON.parse((await output.textContent())!)
  expect(report.orderIndependent).toBe(true)
  expect(report.defaultChoice).toBe('pocket-top')
  expect(report.mergedReadings).toEqual(expect.arrayContaining(['pocket-top', 'pocket-tilted']))
  expect(report.coloring).toEqual({
    samePieces: true,
    changesColors: true,
    consistentApproachColors: true,
    candidatePalette: true,
  })
  expect(report.sharedFloor.floorOffset.z - report.sharedFloor.pocketOffset.z).toBeGreaterThan(8)
  expect(report.innerWalls).toHaveLength(2)
  expect(report.innerWalls.every((wall: { clearsPart: boolean }) => wall.clearsPart)).toBe(true)
  expect(report.dense).toEqual({
    featureGroups: 320,
    featureRenderable: true,
    directionGroups: 320,
    directionRenderable: true,
    overGroupBudget: false,
  })
})
