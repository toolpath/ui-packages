import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReachChart, ReachDrawing } from '../../src/index.js'
import type { FeatureProfile, ReachCurve } from '../../src/model/index.js'

/**
 * Walls stepping as the feature panel's screenshot does, out from 11.684 mm, but
 * tall enough apart that both heights have room for a label in a narrow chart.
 */
const curve: ReachCurve = { offsets: [11.684, 17.272, 20.574], heights: [4, 12, 12] }
const pocket: FeatureProfile = { across: null, depth: null, through: false }
const throughHole: FeatureProfile = {
  across: { width: 6, kind: 'diameter' },
  depth: 8,
  through: true,
}

const section = (): Element => screen.getByRole('img', { name: 'Reach curve, dimensioned' })

/** jsdom lays nothing out: give the drawing the box it was drawn in, so a pointer maps 1:1. */
const pointAt = (svg: Element, clientX: number): void => {
  const width = Number(svg.getAttribute('width'))
  svg.getBoundingClientRect = () => ({ left: 0, width }) as DOMRect
  fireEvent.pointerMove(svg, { clientX })
}

describe('ReachChart', () => {
  it('draws the walls beside the feature, with their heights and where they step', () => {
    render(<ReachChart curve={curve} units="mm" feature={pocket} />)
    expect(section()).toHaveTextContent('FEATURE')
    expect(section()).toHaveTextContent('ADJACENT WALL HEIGHT')
    expect(section()).toHaveTextContent('XY PLANE DISTANCE FROM FEATURE')
    expect(screen.getByText('11.684')).toBeInTheDocument()
    expect(screen.getByText('4.000')).toBeInTheDocument()
    expect(screen.getByText('12.000')).toBeInTheDocument()
  })

  it('writes the lengths in inches when asked', () => {
    render(<ReachChart curve={curve} units="inch" feature={pocket} />)
    expect(screen.getByText('0.4600')).toBeInTheDocument()
  })

  it('names a through feature, and marks its depth', () => {
    render(<ReachChart curve={curve} units="mm" feature={throughHole} />)
    expect(section()).toHaveTextContent('THROUGH FEATURE')
    expect(screen.getByText('8.000')).toBeInTheDocument()
  })

  it('reads the walls under the pointer, and stops when it leaves', () => {
    render(<ReachChart curve={curve} units="mm" feature={pocket} />)
    const svg = section()
    // The feature's wall: its one upright edge drawn heavy.
    const wall = [...svg.querySelectorAll('line[stroke-width="2"]')]
      .map((line) => [Number(line.getAttribute('x1')), Number(line.getAttribute('x2'))])
      .find(([x1, x2]) => x1 === x2)?.[0]
    if (wall === undefined) throw new Error('no wall drawn')

    pointAt(svg, wall + 1)
    expect(screen.getByText(/mm → 4\.000 mm reach/)).toBeInTheDocument()

    fireEvent.pointerLeave(svg)
    expect(screen.queryByText(/reach$/)).toBeNull()
  })

  it('reads nothing left of the wall, inside the feature', () => {
    render(<ReachChart curve={curve} units="mm" feature={pocket} />)
    pointAt(section(), 1)
    expect(screen.queryByText(/→/)).toBeNull()
  })
})

describe('ReachDrawing', () => {
  it('says what the section is and how to read it', () => {
    render(<ReachDrawing curve={curve} units="mm" feature={pocket} />)
    expect(screen.getByText(/Section at the wall · to scale · mm/)).toBeInTheDocument()
    expect(screen.getByText(/Point at the walls to read them/)).toBeInTheDocument()
  })

  it('adds no note on where it stopped when it drew the whole curve', () => {
    render(<ReachDrawing curve={curve} units="mm" feature={pocket} />)
    expect(screen.queryByText(/the Engine read it to/)).toBeNull()
  })

  it('says where it stopped drawing a long level tail', () => {
    const long: ReachCurve = { offsets: [2, 5, 100], heights: [1, 4, 4] }
    render(<ReachDrawing curve={long} units="mm" feature={pocket} />)
    expect(screen.getByText(/the Engine read it to 100\.000 mm/)).toBeInTheDocument()
  })

  it('gives each drawing on a page its own arrowheads', () => {
    render(
      <>
        <ReachChart curve={curve} units="mm" feature={pocket} />
        <ReachDrawing curve={curve} units="mm" feature={pocket} />
      </>,
    )
    const ids = [...document.querySelectorAll('marker')].map((marker) => marker.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    for (const id of ids) expect(id).toMatch(/^[\w-]+$/)
    // Each drawing's dimension points at its own marker, not the other's.
    const svgs = [...document.querySelectorAll('svg')]
    svgs.forEach((svg, index) => {
      const own = svg.querySelector('marker')?.id
      expect(own).toBe(ids[index])
      expect(svg.querySelector('[marker-start]')?.getAttribute('marker-start')).toBe(`url(#${own})`)
    })
  })
})
