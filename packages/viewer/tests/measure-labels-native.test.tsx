// @vitest-environment jsdom
/*
 * The measure tool's labels on React Native: the readout (`measure-readout.tsx`)
 * drawn with the native labels, as the native build resolves them, and each
 * label as the props it registers with the frame. Lines and dots are left out.
 */
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { holeIndex, surfaceCache } from '../src/render/face-measure.js'
import type { MeasureGroup } from '../src/render/measure-picks.js'
import { box, mm } from './measure-parts.js'

interface DrawnLabel {
  text: string
  onPress?: () => void
  accessibilityHint?: string
}

const labels = vi.hoisted(() => [] as Array<DrawnLabel>)

vi.mock('../src/measure-labels.js', () => import('../src/measure-labels.native.js'))
vi.mock('../src/scene-label.js', () => ({
  SceneLabel: (props: DrawnLabel) => {
    labels.push(props)
    return null
  },
}))
vi.mock('@react-three/drei/core/Line.js', () => ({ Line: () => null }))
vi.mock('@react-three/fiber', () => ({ useFrame: () => undefined }))

const { Measurements } = await import('../src/measure-readout.js')

const part = box(20, 10, 6)
const surfaceFor = surfaceCache(part.model, part.geometry)
const holes = holeIndex(part.model, surfaceFor)
const format = (value: number): string => `${mm(value)} mm`
const distance: readonly MeasureGroup[] = [
  [
    { kind: 'point', point: [0, 0, 0] },
    { kind: 'point', point: [3, 4, 0] },
  ],
]

const drawn = (
  onLabelPress?: (label: { text: string; value: string }) => void,
  labelHint?: string,
) => {
  labels.length = 0
  const view = render(
    <Measurements
      groups={distance}
      surfaceFor={surfaceFor}
      holes={holes}
      format={format}
      labelClass=""
      onLabelPress={onLabelPress}
      labelHint={labelHint}
    />,
  )
  return { view, labels: [...labels] }
}

describe('the measure labels on React Native', () => {
  it('tells a screen reader what pressing a label does, in the app’s words', () => {
    expect(drawn(vi.fn(), 'Adds it to the note').labels).toContainEqual(
      expect.objectContaining({ text: '5.000 mm', accessibilityHint: 'Adds it to the note' }),
    )
  })

  it('makes a label a pressable button with no hint where the app gives none', () => {
    const { labels: pressable } = drawn(vi.fn())
    expect(pressable.every((label) => label.onPress && label.accessibilityHint === undefined)).toBe(
      true,
    )
  })

  it('makes no label pressable, and gives no hint, without `onLabelPress`', () => {
    const { labels: none } = drawn()
    expect(none.length).toBeGreaterThan(0)
    expect(none.every((label) => !label.onPress && label.accessibilityHint === undefined)).toBe(
      true,
    )
  })

  it('hands a press the label as drawn and its bare value', () => {
    const onLabelPress = vi.fn()
    const { labels: pressable } = drawn(onLabelPress)
    pressable.find((label) => label.text === 'X 3.000 mm')?.onPress?.()
    expect(onLabelPress).toHaveBeenCalledWith({ text: 'X 3.000 mm', value: '3.000' })
  })

  it('keeps each label’s press while its text holds, so the frame does not draw it again', () => {
    const onLabelPress = vi.fn()
    const { view, labels: first } = drawn(onLabelPress)
    labels.length = 0
    view.rerender(
      <Measurements
        groups={distance}
        surfaceFor={surfaceFor}
        holes={holes}
        format={format}
        labelClass=""
        onLabelPress={onLabelPress}
      />,
    )
    expect(labels.map((label) => label.onPress)).toEqual(first.map((label) => label.onPress))
  })
})
