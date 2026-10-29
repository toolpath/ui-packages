// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MEASURE_LABEL_CLASS } from '../src/render/measure.js'

/** Where drei puts the labels: the canvas's parent, which the labels are read from. */
const root = vi.hoisted(() => ({ element: null as HTMLElement | null }))

vi.mock('@react-three/fiber', () => ({
  addAfterEffect: () => () => undefined,
  useThree: (select: (state: object) => unknown) =>
    select({ events: {}, gl: { domElement: { parentNode: root.element } }, invalidate: () => {} }),
}))

const { MeasureLabelChrome } = await import('../src/measure-labels.js')

/** A label as the tool draws it on the web, in the element the labels live in. */
const labelIn = (text: string): HTMLElement => {
  const container = document.createElement('div')
  const label = document.createElement('div')
  label.className = MEASURE_LABEL_CLASS
  const value = document.createElement('span')
  value.dataset.measureValue = ''
  value.textContent = text
  label.append(value)
  container.append(label)
  document.body.append(container)
  root.element = container
  return value
}

const writeText = vi.fn(() => Promise.resolve())
Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

afterEach(() => {
  writeText.mockClear()
  document.body.replaceChildren()
})

describe('a click on a measure label on the web', () => {
  it('copies the bare value', () => {
    const value = labelIn('4× ⌀ 6.350 mm')
    render(<MeasureLabelChrome />)
    act(() => value.click())
    expect(writeText).toHaveBeenCalledWith('6.350')
  })

  it('goes to `onPress` where it is given, in place of the copy', () => {
    const value = labelIn('4× ⌀ 6.350 mm')
    const onPress = vi.fn()
    render(<MeasureLabelChrome onPress={onPress} />)
    act(() => value.click())
    expect(onPress).toHaveBeenCalledWith({ text: '4× ⌀ 6.350 mm', value: '6.350' })
    expect(writeText).not.toHaveBeenCalled()
  })
})
