import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// drei's `<Html>` portals into the R3F root, which a static render has none of.
// A pass-through keeps what it would wrap, and its props, where a test can read them.
vi.mock('@react-three/drei', () => ({
  Html: ({ children, ...props }: { children: ReactNode }) => (
    <div data-html={JSON.stringify(props)}>{children}</div>
  ),
}))

const { SceneLabel } = await import('../src/scene-label.js')
const { MEASURE_LABEL_CLASS } = await import('../src/render/measure.js')

const inner = (markup: string) =>
  markup.replace(/^<div data-html="[^"]*">/, '').replace(/<\/div>$/, '')
const htmlProps = (markup: string) =>
  JSON.parse((/^<div data-html="([^"]*)">/.exec(markup)?.[1] ?? '{}').replaceAll('&quot;', '"'))

describe('SceneLabel on the web', () => {
  it('renders the markup ToolMarks drew for its labels before it used SceneLabel', () => {
    // `ToolMarks`' own label, as it was written before `SceneLabel` existed.
    const before = renderToStaticMarkup(
      <div className={`${MEASURE_LABEL_CLASS} app-label`} data-measure-label="tool">
        <span data-measure-value>Ø6 end mill</span>
        <span data-measure-note> 24 mm reach</span>
      </div>,
    )
    const markup = renderToStaticMarkup(
      <SceneLabel
        kind="tool"
        position={[1, 2, 3]}
        text="Ø6 end mill"
        note="24 mm reach"
        className="app-label"
      />,
    )

    expect(inner(markup)).toBe(before)
    expect(htmlProps(markup)).toEqual({
      position: [1, 2, 3],
      center: true,
      zIndexRange: [0, 0],
      style: { pointerEvents: 'none' },
    })
  })

  it('carries the measure attributes, colour and layer', () => {
    const markup = renderToStaticMarkup(
      <SceneLabel
        kind="distance"
        axis="z"
        color="#4f8ef7"
        layer={5}
        position={[0, 0, 0]}
        text="12.00 mm"
      />,
    )

    expect(inner(markup)).toBe(
      `<div class="${MEASURE_LABEL_CLASS}" data-measure-label="distance" data-axis="z" style="--measure-color:#4f8ef7"><span data-measure-value="true">12.00 mm</span></div>`,
    )
    expect(htmlProps(markup).zIndexRange).toEqual([5, 0])
  })
})
