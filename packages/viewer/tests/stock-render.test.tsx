import { renderToStaticMarkup } from 'react-dom/server'
import { BoxGeometry } from 'three'
import { describe, expect, it } from 'vitest'
import { Stock } from '../src/stock.js'

describe('Stock shape inputs', () => {
  // The figure is built while Stock renders, before anything needs a Canvas.
  const part = () => new BoxGeometry(20, 30, 10)

  it('rejects a non-finite allowance with RangeError, as boxStockBounds does', () => {
    for (const allowance of [NaN, Infinity, -Infinity]) {
      expect(() =>
        renderToStaticMarkup(<Stock box={{ partGeometry: part(), allowance }} />),
      ).toThrow(RangeError)
    }
  })

  it('rejects non-finite figures with RangeError', () => {
    expect(() =>
      renderToStaticMarkup(
        <Stock box={{ partGeometry: part(), dimensions: { x: NaN, y: 10, z: 10 } }} />,
      ),
    ).toThrow(RangeError)
    expect(() =>
      renderToStaticMarkup(
        <Stock cylinder={{ partGeometry: part(), diameter: Infinity, length: 10 }} />,
      ),
    ).toThrow(RangeError)
  })
})
