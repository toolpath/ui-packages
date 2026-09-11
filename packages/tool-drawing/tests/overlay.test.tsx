import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToolDrawing, frameFor } from '../src/index.js'
import { assemblyOutline } from '../src/geometry/index.js'
import { ClearanceOverlay, NO_MARGINS, tightestGaps, describeGaps } from '../src/clearance/index.js'
import type { ViewerAssembly } from '../src/index.js'

/** A BT30 ER16 holder and a ⌀3 end mill, from the committed sample's shape. */
const assembly: ViewerAssembly = {
  tool: {
    form: 'flat end mill',
    label: 'TDMX0300',
    geometry: { DC: 3, LCF: 8, OAL: 50, RE: 0, NOF: 4, SFDM: 6, LBH: 11 },
    provenance: {},
  },
  holder: {
    gaugeLength: 60,
    colletSeries: 'ER16',
    noseDiameter: 34,
    noseLength: 8,
    bodyDiameter: 42,
    bodyLength: 3,
    projection: 11.6,
    flangeDiameter: 46,
    colletProtrusion: 2,
    provenance: {},
  },
  stickout: 25,
}

const curve = { horizontalOffset: [0, 2, 8, 15], verticalOffset: [12, 12, 30, 30] }
const cuttingRadius = 1.5

const profile = (() => {
  const points: Array<{ r: number; z: number }> = [{ r: cuttingRadius, z: 0 }]
  let from = 0
  curve.horizontalOffset.forEach((offset, index) => {
    const height = curve.verticalOffset[index] ?? 0
    points.push({ r: cuttingRadius + from, z: height })
    points.push({ r: cuttingRadius + offset, z: height })
    from = offset
  })
  return points
})()

class StubResizeObserver {
  static latest: StubResizeObserver | null = null
  private readonly callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    StubResizeObserver.latest = this
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  measure(width: number, height: number) {
    act(() => {
      this.callback(
        [{ contentRect: { width, height } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      )
    })
  }
}

const outline = assemblyOutline(assembly)!
const gaps = tightestGaps(outline.segments, curve, cuttingRadius, NO_MARGINS)
const format = (mm: number) => `${String(Math.round(mm * 100) / 100)} mm`

/**
 * The overlay drawn the ordinary way: as a child, supplying no frame.
 *
 * It cannot supply one — the panel is measured inside `<ToolDrawing>` — so the
 * whole of this suite runs through the context handoff rather than around it.
 */
const withOverlay = (width = 1000, height = 500) => {
  vi.stubGlobal('ResizeObserver', StubResizeObserver)
  const { container } = render(
    <ToolDrawing
      assembly={assembly}
      padding={{ plus: 200 }}
      collisions={[{ part: 'collet', height: 23 }]}
      verdict={{ clears: false, note: describeGaps(gaps, NO_MARGINS, format) }}
    >
      <ClearanceOverlay
        profile={profile}
        cuttingRadius={cuttingRadius}
        gaps={gaps}
        formatLength={format}
      />
    </ToolDrawing>,
  )
  StubResizeObserver.latest!.measure(width, height)
  return container
}

describe('the clearance overlay', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    StubResizeObserver.latest = null
  })

  it('draws in the frame the surrounding drawing settled on, not one of its own', () => {
    const container = withOverlay(1000, 500)
    const drawn = frameFor(outline, { width: 1000, height: 500 }, { padding: { plus: 200 } })

    // The overlay was given no frame at all, so if the wall lands where a
    // frame built from the same panel puts it, the handoff carried the real
    // one. This is what `frameLike` in the consuming application existed to
    // fake, and why it can now be deleted.
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe(drawn.viewBox)
    expect(container.querySelector('[data-wall="cut"]')).not.toBeNull()
  })

  it('refuses to draw outside a drawing rather than inventing a frame', () => {
    vi.stubGlobal('ResizeObserver', StubResizeObserver)

    expect(() =>
      render(
        <ClearanceOverlay
          profile={profile}
          cuttingRadius={cuttingRadius}
          gaps={gaps}
          formatLength={format}
        />,
      ),
    ).toThrow(/inside <ToolDrawing>/)
  })

  it('draws the material, its surface, the break and the wall at the cut', () => {
    const container = withOverlay()

    expect(container.querySelector('[data-clearance]')).not.toBeNull()
    expect(container.querySelector('[data-part="material"]')).not.toBeNull()
    expect(container.querySelector('[data-surface="material"]')).not.toBeNull()
    expect(container.querySelector('[data-break="material"]')).not.toBeNull()
    expect(container.querySelector('[data-wall="cut"]')).not.toBeNull()
  })

  it('hatches the material, because it is metal in section and nothing on the stack is', () => {
    const container = withOverlay()
    const fill = container.querySelector('[data-part="material"]')!.getAttribute('fill')!

    expect(fill).toMatch(/^url\(#hatch-/)
    const id = fill.slice(5, -1)
    expect(container.querySelector(`#${id}`)?.tagName.toLowerCase()).toBe('pattern')
  })

  it('dimensions both clearances at their own points, and reads them out', () => {
    const container = withOverlay()

    expect(container.querySelector('[data-clearance-dimension="axial"]')).not.toBeNull()
    expect(container.querySelector('[data-readout="axial"]')).not.toBeNull()
    expect(container.textContent).toMatch(/−7 mm up/)
  })

  /** A collision is a picture: the section that meets the material is struck. */
  it('paints the section that meets the material, and only that one', () => {
    const container = withOverlay()
    const struck = [...container.querySelectorAll('[data-struck]')].map((each) =>
      each.getAttribute('data-part'),
    )

    expect(struck).toEqual(['collet'])
    expect(container.querySelector('[data-part="collet"]')?.getAttribute('fill')).toBe('#f87171')
  })

  /**
   * **One part may emit several segments**, so a collision is matched by
   * height as well as by part: this holder draws a stated `body` and the
   * diameter carried up above it, and only one of them can be in the material.
   */
  it('strikes the body segment the collision is in, not both of them', () => {
    vi.stubGlobal('ResizeObserver', StubResizeObserver)
    const bodies = [...outline.segments.entries()].filter(([, each]) => each.part === 'body')
    expect(bodies.length).toBe(2)
    const [, lower] = bodies[0]!
    const inLower = lower.points[0]!.z

    const { container } = render(
      <ToolDrawing assembly={assembly} collisions={[{ part: 'body', height: inLower }]} />,
    )
    const struck = container.querySelectorAll('[data-struck]')

    expect(struck).toHaveLength(1)
  })

  it('says in the caption whether the assembly cleared, and by how much', () => {
    const container = withOverlay()

    expect(container.querySelector('[data-verdict]')?.getAttribute('data-verdict')).toBe('collides')
    expect(container.querySelector('[data-verdict-note]')?.textContent).toMatch(
      /tightest: 7 mm into the wall at the collet/,
    )
  })
})

/**
 * **Optionality is the acceptance test**, in all three senses: a subpath of its
 * own, no Toolpath schema dependency, and — proved here rather than reasoned
 * about — omitting the props draws the tool alone.
 */
describe('the tool alone, with none of it', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    StubResizeObserver.latest = null
  })

  it('draws no overlay, no verdict and no collision paint', () => {
    const { container } = render(<ToolDrawing assembly={assembly} />)

    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelector('[data-silhouette]')).not.toBeNull()
    expect(container.querySelector('[data-clearance]')).toBeNull()
    expect(container.querySelector('[data-part="material"]')).toBeNull()
    expect(container.querySelector('[data-struck]')).toBeNull()
    expect(container.querySelector('[data-verdict]')).toBeNull()
    expect(container.querySelector('[data-verdict-note]')).toBeNull()
    // And every section is painted as metal, not as struck.
    for (const section of container.querySelectorAll('[data-part]')) {
      expect(section.getAttribute('fill')).not.toBe('#f87171')
    }
  })

  it('draws the dimensions without the overlay too', () => {
    vi.stubGlobal('ResizeObserver', StubResizeObserver)
    const { container } = render(<ToolDrawing assembly={assembly} dimensions />)
    StubResizeObserver.latest!.measure(900, 900)

    expect(container.querySelector('[data-dimensions]')).not.toBeNull()
    expect(container.querySelector('[data-clearance]')).toBeNull()
  })
})
