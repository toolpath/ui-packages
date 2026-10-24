import { expect, test } from '@playwright/test'
import { createExplosionMotion } from '../src/explode/motion'

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

test('eases transitions, reverses without a jump, and stops at the scrubbed amount', () => {
  const motion = createExplosionMotion(0)
  let time = 0
  const step = (milliseconds: number) => {
    const end = time + milliseconds
    while (time < end) {
      time = Math.min(end, time + 10)
      motion.advance(time)
    }
  }
  motion.moveTo(1)
  motion.advance(time)
  step(100)
  expect(motion.amount).toBeGreaterThan(0)
  expect(motion.amount).toBeLessThan(0.01)
  step(800)
  expect(motion.amount).toBeCloseTo(0.5)
  motion.moveTo(0)
  motion.advance(time)
  expect(motion.amount).toBeCloseTo(0.5)
  step(450)
  expect(motion.amount).toBeCloseTo(0.25)
  motion.seek(0.3)
  step(1000)
  expect(motion.amount).toBe(0.3)
  expect(motion.getSnapshot().mode).toBe('idle')
  motion.moveTo(0, true)
  expect(motion.amount).toBe(0)
  motion.moveTo(1)
  motion.advance(time)
  step(1800)
  expect(motion.amount).toBe(1)
  expect(motion.getSnapshot().mode).toBe('idle')
})

test('finishes in elapsed time even when frames are hundreds of milliseconds apart', () => {
  const motion = createExplosionMotion(0)
  motion.moveTo(1)
  motion.advance(0)
  motion.advance(300)
  motion.advance(900)
  expect(motion.amount).toBeCloseTo(0.5)
  expect(motion.advance(1800)).toBe(false)
  expect(motion.amount).toBe(1)
  expect(motion.getSnapshot().mode).toBe('idle')

  motion.moveTo(0)
  motion.advance(2000)
  motion.advance(2900)
  expect(motion.amount).toBeCloseTo(0.5)
  expect(motion.advance(3800)).toBe(false)
  expect(motion.amount).toBe(0)
})

test('resumes a suspended clock without counting time spent in the background', () => {
  const motion = createExplosionMotion(0)
  motion.moveTo(1)
  motion.advance(0)
  motion.advance(100)
  const before = motion.amount
  motion.resetClock()
  expect(motion.advance(10_000)).toBe(true)
  expect(motion.amount).toBe(before)
  motion.advance(10_100)
  expect(motion.amount).toBeGreaterThan(before)
  expect(motion.advance(11_700)).toBe(false)
  expect(motion.amount).toBe(1)
})
