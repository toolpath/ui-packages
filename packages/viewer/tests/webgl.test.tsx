import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isWebGLAvailable } from '../src/render/webgl.js'
import { Viewer } from '../src/viewer.js'
import { WebGLUnavailable } from '../src/webgl-unavailable.js'

const stubCanvas = (getContext: () => unknown) => {
  vi.stubGlobal('document', { createElement: () => ({ getContext }) })
}

describe('isWebGLAvailable', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is false without a document', () => {
    expect(isWebGLAvailable()).toBe(false)
  })

  it('is false when the browser refuses a WebGL2 context', () => {
    stubCanvas(() => null)
    expect(isWebGLAvailable()).toBe(false)
  })

  it('is false when asking for a context throws', () => {
    stubCanvas(() => {
      throw new Error('blocked')
    })
    expect(isWebGLAvailable()).toBe(false)
  })

  it('is true for a WebGL2 context, and releases the probe', () => {
    const loseContext = vi.fn()
    const getContext = vi.fn(() => ({ getExtension: () => ({ loseContext }) }))
    stubCanvas(getContext)

    expect(isWebGLAvailable()).toBe(true)
    expect(getContext).toHaveBeenCalledWith('webgl2')
    expect(loseContext).toHaveBeenCalledOnce()
  })
})

describe('Viewer on the server', () => {
  it('assumes WebGL, so hydration matches the canvas markup', () => {
    const markup = renderToStaticMarkup(<Viewer webglUnavailable={<p>Use another browser.</p>} />)

    expect(markup).toContain('viewer-canvas-container')
    expect(markup).not.toContain('viewer-webgl-unavailable')
    expect(markup).not.toContain('Use another browser.')
  })
})

describe('WebGLUnavailable', () => {
  it('renders an alert asking for graphics acceleration', () => {
    const markup = renderToStaticMarkup(<WebGLUnavailable />)

    expect(markup).toContain('class="viewer-webgl-unavailable"')
    expect(markup).toContain('data-viewer-webgl-unavailable="true"')
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('3D view unavailable')
    expect(markup).toContain('Turn on graphics (hardware) acceleration')
  })

  it('shows the application message instead of the default', () => {
    const markup = renderToStaticMarkup(
      <WebGLUnavailable>
        <p>Use another browser.</p>
      </WebGLUnavailable>,
    )

    expect(markup).toContain('<p>Use another browser.</p>')
    expect(markup).not.toContain('3D view unavailable')
  })
})
