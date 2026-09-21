import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HoverCard } from '../src/hover-card.js'
import { ViewerToolbar } from '../src/viewer-toolbar.js'

describe('viewer styling hooks', () => {
  it('keeps stable toolbar classes and action identifiers beside a caller class', () => {
    const markup = renderToStaticMarkup(
      <ViewerToolbar
        className="app-toolbar"
        stock={false}
        axes={false}
        grid={false}
        directions={false}
        hover={false}
        focus={false}
        wireframe={false}
        sectioning={false}
        measuring={false}
        onFit={() => {}}
        onReset={() => {}}
        onTop={() => {}}
        onStock={() => {}}
        onAxes={() => {}}
        onGrid={() => {}}
        onDirections={() => {}}
        onHover={() => {}}
        onFocus={() => {}}
        onWireframe={() => {}}
        onSection={() => {}}
        onMeasure={() => {}}
      />,
    )

    expect(markup).toContain('class="viewer-toolbar-stack app-toolbar"')
    expect(markup).toContain('data-viewer-toolbar="true"')
    expect(markup).toContain('class="viewer-toolbar-button"')
    expect(markup).toContain('data-viewer-toolbar-action="stock"')
    expect(markup).toContain('class="viewer-toolbar-icon"')
    expect(markup).toContain('class="viewer-toolbar-tooltip"')
    expect(markup).toContain('class="viewer-toolbar-divider"')
  })

  it('gives hover cards a default class without replacing a caller class', () => {
    const markup = renderToStaticMarkup(
      <HoverCard
        className="app-hover-card"
        pick={{
          region: 1,
          owners: [],
          ranked: [],
          best: null,
          triangleIndex: 0,
          point: [0, 0, 0],
          normal: [0, 0, 1],
          pointer: { clientX: 10, clientY: 20 },
          modifiers: { alt: false, ctrl: false, meta: false, shift: false, secondary: false },
          doubled: false,
        }}
      >
        {() => 'Details'}
      </HoverCard>,
    )

    expect(markup).toContain('class="viewer-hover-card app-hover-card"')
    expect(markup).toContain('data-viewer-hover-card="true"')
  })
})
