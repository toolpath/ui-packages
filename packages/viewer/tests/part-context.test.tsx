import { renderToStaticMarkup } from 'react-dom/server'
import { BufferGeometry } from 'three'
import { describe, expect, it } from 'vitest'
import { PartContext, usePartContext } from '../src/part-context.js'
import { cubeModel } from './fixtures.js'

const Reader = () => {
  const { model, geometry } = usePartContext()
  return <span>{`${model.features.length} features, ${geometry.uuid === '' ? '' : 'a mesh'}`}</span>
}

describe('usePartContext', () => {
  it('reads the part an overlay is drawn inside', () => {
    const model = cubeModel()
    const html = renderToStaticMarkup(
      <PartContext.Provider value={{ model, geometry: new BufferGeometry() }}>
        <Reader />
      </PartContext.Provider>,
    )
    expect(html).toContain(`${model.features.length} features, a mesh`)
  })

  it('throws outside a part', () => {
    expect(() => renderToStaticMarkup(<Reader />)).toThrow(/inside <PartMesh> or <EnginePart>/)
  })
})
