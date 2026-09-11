import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SHEETS, ToolDrawing } from '../src/index.js'
import type { ViewerAssembly, ViewerHolderProfile } from '../src/index.js'

const assembly: ViewerAssembly = {
  tool: {
    form: 'flat end mill',
    label: 'TDMX0600',
    geometry: { DC: 6, LCF: 13, OAL: 57, SFDM: 6, LBH: 19 },
    provenance: { LBH: 'derived' },
  },
  holder: {
    gaugeLength: 50,
    colletSeries: 'PG6',
    noseDiameter: 28,
    noseLength: null,
    bodyDiameter: null,
    bodyLength: null,
    projection: null,
    flangeDiameter: null,
    colletProtrusion: null,
    provenance: {},
  },
  stickout: 25,
}

/**
 * The distinct parts drawn, in the order each first appears.
 *
 * **One part may emit several segments**, so this is deliberately not the
 * segment sequence: a slot mill's cutting disc emits two `flutes` (a straight
 * side and a corner arc), and a holder whose flange stands above its stated
 * body emits two `body` (the stated one, and the last stated diameter carried
 * up). A test that does not specifically care about segmentation asserts on
 * the set of parts, so it does not break the next time segmentation changes.
 */
const partsDrawn = (container: HTMLElement) => [
  ...new Set(
    [...container.querySelectorAll('[data-part]')].map((each) => each.getAttribute('data-part')),
  ),
]

/** One polygon per segment, not per part. */
const segmentCount = (container: HTMLElement) => container.querySelectorAll('[data-part]').length

describe('the assembly, drawn', () => {
  it('draws every part from the stated dimensions', () => {
    const { container } = render(<ToolDrawing assembly={assembly} />)

    expect(container.querySelector('[role="img"]')).not.toBeNull()
    expect(partsDrawn(container)).toEqual(['tip', 'flutes', 'shank', 'nose'])
  })

  it('draws the tool alone when there is no holder', () => {
    const { container } = render(<ToolDrawing assembly={{ ...assembly, holder: null }} />)

    expect(partsDrawn(container)).toEqual(['tip', 'flutes', 'shank'])
  })

  it('draws every line solid, keeps the provenance on the element, and names what was assumed', () => {
    const drill = { ...assembly, tool: { ...assembly.tool, form: 'drill' } }
    const { container } = render(<ToolDrawing assembly={drill} />)

    const tip = container.querySelector('[data-part="tip"]')
    expect(tip?.getAttribute('stroke-dasharray')).toBeNull()
    expect(tip?.getAttribute('data-provenance')).toBe('assumed')
    expect(container.querySelector('[data-provenance-note]')?.textContent).toMatch(
      /tip angle assumed/,
    )
  })

  it('says the holder length is not stated when it is not', () => {
    const { container } = render(
      <ToolDrawing
        assembly={{ ...assembly, holder: { ...assembly.holder!, gaugeLength: null } }}
      />,
    )

    expect(container.querySelector('[data-provenance-note]')?.textContent).toMatch(
      /The holder length is not stated\./,
    )
  })

  /**
   * A measured holder answers the same question from a different field: a
   * `gage-line` profile *is* referenced to the spindle face, and a `nose` one
   * had no gauge plane to solve.
   */
  it('reads a measured holder\u2019s length off its datum', () => {
    const measured: ViewerHolderProfile = {
      points: [
        [-40, 11],
        [-10, 20],
        [30, 16],
        [50, 8],
      ],
      datum: 'gage-line',
      colletSeries: null,
      colletProtrusion: null,
    }
    const { container, rerender } = render(
      <ToolDrawing assembly={{ ...assembly, holder: measured }} />,
    )

    expect(partsDrawn(container)).toEqual(['tip', 'flutes', 'shank', 'body', 'flange'])
    expect(container.querySelector('[data-provenance-note]')?.textContent).not.toMatch(
      /The holder length is not stated\./,
    )

    rerender(
      <ToolDrawing
        assembly={{
          ...assembly,
          holder: {
            ...measured,
            datum: 'nose',
            points: [
              [-40, 11],
              [0, 8],
            ],
          },
        }}
      />,
    )
    expect(container.querySelector('[data-provenance-note]')?.textContent).toMatch(
      /The holder length is not stated\./,
    )
  })
})

/**
 * **A drawing sheet, in its own colours.** Gold flutes, a steel body, the
 * holder behind it in a grey of its own — hard values rather than the
 * application's ramp, because the ramp flips under light mode and a drawing is
 * a drawing in either theme (Paul, 2026-09-01).
 */
describe('the sheet and its ink', () => {
  /** Nose, body, the carry above it, and the flange: every holder section drawn. */
  const carried: ViewerAssembly = {
    ...assembly,
    stickout: 30,
    holder: {
      ...assembly.holder!,
      noseLength: 10.55,
      bodyDiameter: 12.02,
      bodyLength: 9.6,
      projection: 50,
      flangeDiameter: 46,
      colletProtrusion: 2.5,
    },
  }

  const connected: ViewerAssembly = {
    ...assembly,
    holder: {
      ...assembly.holder!,
      bodyDiameter: 40,
      bodyLength: 20,
      // Past the nose and the body, so the cone nobody states is drawn up to it.
      projection: 110,
      flangeDiameter: 46,
    },
  }

  /**
   * **A holder emits two `body` segments** where the flange stands above the
   * body the vendor states: the stated body, and then the last stated diameter
   * carried up to the flange because nothing states what is in between. They
   * are told apart by provenance, not by part — the carried one is `assumed`,
   * and it is the spindle connection rather than the holder body.
   *
   * This is the second place one part emits several segments, and unlike the
   * slot mill it is exercisable from the committed sample, which is the only
   * dataset carrying toolholding.
   */
  it('draws both body segments, and paints the carried one as the connection', () => {
    const { container } = render(<ToolDrawing assembly={carried} />)
    const bodies = [...container.querySelectorAll('[data-part="body"]')]

    expect(bodies).toHaveLength(2)
    expect(bodies.map((each) => each.getAttribute('data-provenance'))).toEqual([
      'vendor-stated',
      'assumed',
    ])
    expect(bodies.map((each) => each.getAttribute('fill'))).toEqual(['#474d57', '#3a4048'])
    // One part, two segments, one name in the note.
    expect(partsDrawn(container).filter((each) => each === 'body')).toHaveLength(1)
    expect(segmentCount(container)).toBeGreaterThan(partsDrawn(container).length)
  })

  it('paints the flutes gold, the body steel and the holder its own grey', () => {
    const { container } = render(<ToolDrawing assembly={connected} />)
    const painted = (selector: string) => container.querySelector(selector)?.getAttribute('fill')

    expect(painted('[data-part="flutes"]')).toBe('#c9a44b')
    expect(painted('[data-part="shank"]')).toBe('#5b626c')
    expect(painted('[data-part="nose"]')).toBe('#474d57')
    expect(painted('[data-part="flange"]')).toBe('#3a4048')
  })

  /**
   * And the sheet is a shade above the card rather than a white rectangle in a
   * dark application — with the ink turned over to match. Dark is the default
   * because the sheet that needed stating was the dark one.
   */
  it('draws on a dark sheet by default', () => {
    const { container } = render(<ToolDrawing assembly={assembly} />)
    const svg = container.querySelector('svg')!

    expect(svg.style.background).toBe('rgb(34, 37, 43)')
    expect(container.querySelector('[data-centreline]')?.getAttribute('stroke')).toBe('#e8ebef')
  })

  it('turns the whole sheet over when the application passes the light theme', () => {
    const { container } = render(<ToolDrawing assembly={connected} theme="light" />)
    const svg = container.querySelector('svg')!

    expect(svg.style.background).toBe('rgb(255, 255, 255)')
    expect(container.querySelector('[data-centreline]')?.getAttribute('stroke')).toBe('#15181c')
    expect(container.querySelector('[data-part="flutes"]')?.getAttribute('fill')).toBe('#e6bf59')
    expect(container.querySelector('[data-silhouette]')?.getAttribute('stroke')).toBe('#3f4650')
  })
})

/**
 * § 8's whole point: a silent plausible picture is the failure mode, so a form
 * this cannot draw is said in words — and the words name the form, because a
 * reader shown nothing is owed the reason.
 */
describe('what it will not draw', () => {
  it('says so rather than drawing a tool with no dimensions', () => {
    const { container } = render(
      <ToolDrawing assembly={{ ...assembly, tool: { ...assembly.tool, geometry: {} } }} />,
    )

    expect(container.querySelector('svg')).toBeNull()
    expect(container.textContent).toMatch(/states no cutting diameter or flute length/)
  })

  it('names the form it has no shape for, rather than drawing a plausible cylinder', () => {
    const { container } = render(
      <ToolDrawing assembly={{ ...assembly, tool: { ...assembly.tool, form: 'dovetail mill' } }} />,
    )

    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('[data-undrawable]')?.getAttribute('data-undrawable')).toBe(
      'dovetail mill',
    )
    expect(container.textContent).toMatch(/is a dovetail mill/)
    expect(container.textContent).toMatch(/not drawn, rather than drawn wrong/)
  })
})

/**
 * The frame is only honest under `xMidYMid meet`: it fits a viewBox by the
 * smaller of its own two ratios, and `frameFor` picks `scale` so that the
 * binding ratio is exactly `scale`. Under `none` the drawing stretches and the
 * reported scale is a lie on one axis.
 */
describe('the contract with the frame', () => {
  it('keeps preserveAspectRatio at xMidYMid meet', () => {
    const { container } = render(<ToolDrawing assembly={assembly} />)

    expect(container.querySelector('svg')?.getAttribute('preserveAspectRatio')).toBe(
      'xMidYMid meet',
    )
  })

  it('draws into a viewBox from the content, not from the panel', () => {
    const { container } = render(<ToolDrawing assembly={assembly} />)
    const [, , width] = container
      .querySelector('svg')!
      .getAttribute('viewBox')!
      .split(' ')
      .map(Number)

    // 75 mm of stack plus its margins — not the hundreds of millimetres the
    // panel's aspect ratio used to buy.
    expect(width).toBeGreaterThan(75)
    expect(width).toBeLessThan(90)
  })
})

/**
 * jsdom has no `ResizeObserver`, so every test above draws at the unmeasured
 * default frame — which is landscape. Without this the vertical half of the
 * package would never run. The observer is stubbed so a panel can be handed a
 * shape and the drawing asked what it did with it.
 */
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

const drawnIn = (width: number, height: number) => {
  vi.stubGlobal('ResizeObserver', StubResizeObserver)
  const { container } = render(<ToolDrawing assembly={assembly} />)
  StubResizeObserver.latest!.measure(width, height)
  const centreline = container.querySelector('[data-centreline]')!
  const at = (name: string) => Number(centreline.getAttribute(name))
  const [, , w, h] = container.querySelector('svg')!.getAttribute('viewBox')!.split(' ').map(Number)
  return {
    container,
    viewBox: { width: w!, height: h! },
    x1: at('x1'),
    y1: at('y1'),
    x2: at('x2'),
    y2: at('y2'),
  }
}

/**
 * Orientation lives only in the frame's `toX`/`toY`. Nothing in this renderer
 * branches on it, so the proof is that the same assembly, drawn into panels of
 * two shapes, comes out along each panel's long axis without the renderer
 * being told which.
 */
describe('the axis follows the panel, and only through toX and toY', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    StubResizeObserver.latest = null
  })

  it('lays the tool along a wide panel', () => {
    const drawn = drawnIn(1032, 232)

    expect(drawn.viewBox.width).toBeGreaterThan(drawn.viewBox.height)
    // The centreline runs across the sheet: the axis is horizontal.
    expect(drawn.y1).toBe(drawn.y2)
    expect(drawn.x1).not.toBe(drawn.x2)
  })

  it('stands the same tool up in a tall panel', () => {
    const drawn = drawnIn(232, 1032)

    expect(drawn.viewBox.height).toBeGreaterThan(drawn.viewBox.width)
    // And now up it: same renderer, same segments, the other axis.
    expect(drawn.x1).toBe(drawn.x2)
    expect(drawn.y1).not.toBe(drawn.y2)
  })

  it('frames the same content either way, transposed', () => {
    const wide = drawnIn(1032, 232)
    vi.unstubAllGlobals()
    const tall = drawnIn(232, 1032)

    expect(wide.viewBox.width).toBeCloseTo(tall.viewBox.height, 6)
    expect(wide.viewBox.height).toBeCloseTo(tall.viewBox.width, 6)
  })
})

const viewBoxOf = (container: HTMLElement) => {
  const [minX, minY, width, height] = container
    .querySelector('svg')!
    .getAttribute('viewBox')!
    .split(' ')
    .map(Number)
  return { minX: minX!, minY: minY!, width: width!, height: height! }
}

const drawnWith = (props: Record<string, unknown>, width = 900, height = 900) => {
  vi.stubGlobal('ResizeObserver', StubResizeObserver)
  const { container } = render(<ToolDrawing assembly={assembly} {...props} />)
  StubResizeObserver.latest!.measure(width, height)
  return container
}

const codesDrawn = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-dimension]')].map((each) =>
    each.getAttribute('data-dimension'),
  )

describe('the dimensions', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    StubResizeObserver.latest = null
  })

  it('dimensions the tool only when it is asked to', () => {
    const { container: plain } = render(<ToolDrawing assembly={assembly} />)
    expect(plain.querySelector('[data-dimensions]')).toBeNull()

    const container = drawnWith({ dimensions: true })
    const drawn = codesDrawn(container)

    // With a holder: the stickout, and no overall length — most of the shank
    // is inside the holder.
    expect(drawn).toContain('stickout')
    expect(drawn).not.toContain('OAL')
    expect(drawn).toEqual(expect.arrayContaining(['DC', 'SFDM', 'LCF']))
  })

  /** The tool alone states its own overall length, and nothing about a holder. */
  it('dimensions the overall length when the tool is drawn by itself', () => {
    vi.stubGlobal('ResizeObserver', StubResizeObserver)
    const { container } = render(
      <ToolDrawing assembly={{ ...assembly, holder: null, stickout: null }} dimensions />,
    )
    StubResizeObserver.latest!.measure(900, 900)
    const drawn = codesDrawn(container)

    expect(drawn).toContain('OAL')
    expect(drawn).not.toContain('stickout')
  })

  /**
   * **An extension line starts at the solid it measures.** The lane itself
   * runs outside the whole view, which is what a sheet does — but the line
   * that carries the eye to it began at `Outline.radius`, and with a holder
   * that is the widest thing anywhere in the stack. On this assembly it is the
   * ⌀28 nose over a ⌀6 shank, so every extension line started eleven
   * millimetres out in the margin and pointed at nothing.
   */
  it('carries a length’s extension line back to the tool, not to the holder', () => {
    const container = drawnWith({ dimensions: true })
    // A square panel is drawn along its width, so a radius is the sheet's y.
    const extension = container.querySelector('[data-dimension="LCF"] line')!
    const radius = (name: string) => Math.abs(Number(extension.getAttribute(name)))

    // The ⌀6 shank, and a hair clear of it — not the ⌀28 nose.
    expect(radius('y2')).toBeGreaterThan(3)
    expect(radius('y2')).toBeLessThan(5)
    /**
     * And the lane it runs out to sits just past the silhouette rather than an
     * arrow's length beyond it: a width dimensioned here is the cutter and the
     * shank, nowhere near the edge, so the ladder reserves the arrows no room
     * out at the nose.
     */
    expect(radius('y1')).toBeGreaterThan(14)
    expect(radius('y1')).toBeLessThan(16)
  })

  /**
   * **The padding seam.** The lanes' room is stated in pixels and settled
   * before the frame exists, so asking for it cannot change the scale that
   * would change it back. What it must do is actually buy room: the drawing
   * with dimensions on is framed wider than the same drawing without.
   */
  it('buys the lanes their room out of the frame, not out of the scale', () => {
    const bare = viewBoxOf(drawnWith({}))
    const dimensioned = viewBoxOf(drawnWith({ dimensions: true }))

    // A square panel is drawn along its width, so the lanes take their room
    // across it — which is the sheet's height.
    expect(dimensioned.height).toBeGreaterThan(bare.height)
  })

  /**
   * And asymmetrically, which is why the seam had to widen from one number:
   * with lanes on both flanks each side takes what its own lines need, and an
   * odd count of lengths leaves those different.
   */
  it('gives each flank the room its own lines need', () => {
    const one = viewBoxOf(drawnWith({ dimensions: true, dimensionSides: 'one' }))
    const both = viewBoxOf(drawnWith({ dimensions: true, dimensionSides: 'both' }))

    // Everything on one flank: the tool sits well off centre in its sheet.
    expect(Math.abs(one.minY + one.height / 2)).toBeGreaterThan(1)
    // Split across both: the two margins are nearer each other.
    expect(Math.abs(both.minY + both.height / 2)).toBeLessThan(Math.abs(one.minY + one.height / 2))
  })

  /**
   * **The drawing letters nothing** (Paul, 2026-09-02). The numbers are in the
   * consumer's own table an inch away, and six two-line figures fighting for
   * the margin said them a second time, worse.
   */
  it('writes no number on the sheet', () => {
    const container = drawnWith({ dimensions: true, dimensionSides: 'both' })
    const inside = container.querySelector('svg')!

    expect(inside.querySelectorAll('text')).toHaveLength(0)
    expect(inside.querySelector('[data-figure]')).toBeNull()
  })
})

/**
 * **Which line is which is said by pointing at it** (Paul, 2026-09-02). Both
 * directions key on the ISO 13399 code, which the drawing and the consumer's
 * table already had in common.
 */
describe('the dimension the reader is pointing at', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    StubResizeObserver.latest = null
  })

  const lit = (container: HTMLElement) =>
    [...container.querySelectorAll('[data-lit="true"]')].map((each) =>
      each.getAttribute('data-dimension'),
    )

  it('lights the one it is told to, and nothing else', () => {
    const container = drawnWith({ dimensions: true, highlight: 'LCF' })

    expect(lit(container)).toEqual(['LCF'])
  })

  it('takes several at once', () => {
    const container = drawnWith({ dimensions: true, highlight: ['DC', 'LCF'] })

    expect(lit(container).sort()).toEqual(['DC', 'LCF'])
  })

  /**
   * The table carries numbers the drawing has no line for — L/D and the flute
   * count — and pointing at one of those must light nothing rather than throw.
   */
  it('lights nothing for a code it does not dimension', () => {
    expect(lit(drawnWith({ dimensions: true, highlight: 'LD' }))).toEqual([])
    expect(lit(drawnWith({ dimensions: true }))).toEqual([])
  })

  /**
   * One line answers to both its names. Where the shop clamps to its own rule
   * the stickout and the below-holder length are one number, drawn once — and
   * a table lighting either of them lights it.
   */
  it('lights the one line two codes name', () => {
    const clamped = {
      ...assembly,
      tool: { ...assembly.tool, geometry: { ...assembly.tool.geometry, LBH: 25 } },
    }
    const drawn = (highlight: string) => {
      vi.stubGlobal('ResizeObserver', StubResizeObserver)
      const { container } = render(
        <ToolDrawing assembly={clamped} dimensions highlight={highlight} />,
      )
      StubResizeObserver.latest!.measure(900, 900)
      return container
    }

    expect(lit(drawn('LBH'))).toEqual(['LBH'])
    expect(lit(drawn('stickout'))).toEqual(['LBH'])
  })

  /** In the sheet's accent, and heavier — colour alone is not the highlight. */
  it('draws it in the accent, and thicker than the same line unlit', () => {
    const line = (container: HTMLElement) => container.querySelector('[data-dimension="LCF"] line')!
    const plain = line(drawnWith({ dimensions: true }))
    const hot = line(drawnWith({ dimensions: true, highlight: 'LCF' }))

    expect(hot.getAttribute('stroke')).toBe(SHEETS.dark.accent)
    expect(plain.getAttribute('stroke')).toBe(SHEETS.dark.dimension)
    expect(Number(hot.getAttribute('stroke-width'))).toBeGreaterThan(
      Number(plain.getAttribute('stroke-width')),
    )
  })

  it('reports the code under the pointer, and the leaving of it', () => {
    const told: Array<string | null> = []
    const container = drawnWith({
      dimensions: true,
      onDimensionHover: (code: string | null) => told.push(code),
    })
    const group = container.querySelector('[data-dimension="LCF"]')!

    fireEvent.pointerEnter(group)
    fireEvent.pointerLeave(group)

    expect(told).toEqual(['LCF', null])
  })

  /**
   * A dimension line is a fraction of a millimetre of ink, so each one carries
   * a wide invisible run to be caught by — but only where somebody is
   * listening, so a drawing nobody is pointing at stays inert.
   */
  it('puts hit targets on the lines only for a consumer that listens', () => {
    const targets = (container: HTMLElement) =>
      container.querySelectorAll('[data-dimensions] [stroke="transparent"]')

    expect(targets(drawnWith({ dimensions: true })).length).toBe(0)
    expect(
      targets(drawnWith({ dimensions: true, onDimensionHover: () => undefined })).length,
    ).toBeGreaterThan(0)
  })
})
