import { describe, expect, it, vi } from 'vitest'
import { viewerToolGroups } from '../src/viewer-tools.js'

describe('viewerToolGroups', () => {
  it('keeps only the tools the app supplied, and drops a group left empty', () => {
    const groups = viewerToolGroups({
      grid: { pressed: true, onClick: () => {} },
      fit: { onClick: () => {} },
    })

    expect(groups.map((group) => group.id)).toEqual(['scene', 'view'])
    expect(groups[0]?.tools.map((tool) => tool.id)).toEqual(['grid'])
  })

  it('reads a toggle as on or off, and an action as neither', () => {
    const [scene, view] = viewerToolGroups({
      axes: { onClick: () => {} },
      grid: { pressed: true, onClick: () => {} },
      top: { pressed: true, onClick: () => {} },
    })

    expect(scene?.tools.map((tool) => tool.on)).toEqual([false, true])
    expect(view?.tools[0]?.on).toBeUndefined()
  })

  it("calls the control's own click", () => {
    const onClick = vi.fn()
    const [scene] = viewerToolGroups({ stock: { onClick } })

    scene?.tools[0]?.onClick()

    expect(onClick).toHaveBeenCalledOnce()
  })

  it("takes the app's notes and gates in place of the standard ones", () => {
    const [scene, dfm] = viewerToolGroups(
      {
        stock: { onClick: () => {} },
        directions: { onClick: () => {} },
        hover: { onClick: () => {} },
      },
      {
        notes: { stock: 'The smallest round bar the part fits in' },
        gates: { directions: 'Waits for the DFM check', hover: null },
      },
    )

    expect(scene?.tools[0]?.note).toBe('The smallest round bar the part fits in')
    expect(dfm?.tools.map((tool) => tool.gate)).toEqual(['Waits for the DFM check', null])
  })
})
