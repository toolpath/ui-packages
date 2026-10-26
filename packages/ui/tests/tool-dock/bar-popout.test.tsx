import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToolDock, type BarPopout } from '../../src'

const box = (x: number, y: number, width: number, height: number): DOMRect =>
  ({
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
  }) as DOMRect

/** A control at the end of the bar, handing out where its popup would open. */
const Probe = ({ onPopout }: { onPopout: (popout: BarPopout<HTMLButtonElement>) => void }) => {
  const popout = ToolDock.useBarPopout<HTMLButtonElement>()
  onPopout(popout)
  return (
    <button type="button" ref={popout.trigger}>
      Settings
    </button>
  )
}

const renderProbe = (): BarPopout<HTMLButtonElement> => {
  let popout: BarPopout<HTMLButtonElement> | undefined
  render(
    <ToolDock groups={[]}>
      <Probe onPopout={(given) => (popout = given)} />
    </ToolDock>,
  )
  return popout!
}

const stubBox = (element: HTMLElement, rect: DOMRect): void => {
  element.getBoundingClientRect = () => rect
}

describe('ToolDock.useBarPopout', () => {
  it("opens over its control, 4px past the bar's edge, not the control's", () => {
    const popout = renderProbe()
    stubBox(screen.getByRole('group', { name: 'Tools' }), box(0, 500, 400, 40))
    stubBox(screen.getByRole('button', { name: 'Settings' }), box(350, 505, 44, 32))

    const anchor = popout.anchor.getBoundingClientRect()

    expect(anchor).toMatchObject({ left: 350, width: 44, top: 500, bottom: 540 })
    expect(popout.sideOffset).toBe(4)
    expect(popout.anchor.contextElement).toBe(screen.getByRole('button', { name: 'Settings' }))
  })

  it('says which hooks it is for when used outside a dock', () => {
    const Outside = () => {
      ToolDock.useBarPopout()
      return null
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Outside />)).toThrow(/useBarPopout must be used inside <ToolDock>/)
  })
})
