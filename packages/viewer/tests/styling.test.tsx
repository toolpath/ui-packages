import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HoverCard } from '../src/hover-card.js'
import { ViewerToolbar, ViewerToolbarProvider } from '../src/viewer-toolbar.js'

describe('viewer styling hooks', () => {
  it('keeps stable toolbar classes and action identifiers beside a caller class', () => {
    const markup = renderToStaticMarkup(
      <ViewerToolbarProvider
        controls={{
          stock: { pressed: false, onClick: () => {} },
          axes: { pressed: false, onClick: () => {} },
          grid: { pressed: false, onClick: () => {} },
          banana: { pressed: false, onClick: () => {} },
          directions: { pressed: false, onClick: () => {} },
          hover: { pressed: false, onClick: () => {} },
          focus: { pressed: false, onClick: () => {} },
          wireframe: { pressed: false, onClick: () => {} },
          section: { pressed: false, onClick: () => {} },
          measure: { pressed: false, onClick: () => {} },
          fit: { onClick: () => {} },
          reset: { onClick: () => {} },
          top: { onClick: () => {} },
        }}
      >
        <ViewerToolbar className="app-toolbar" />
      </ViewerToolbarProvider>,
    )

    expect(markup).toContain('class="viewer-toolbar-stack app-toolbar"')
    expect(markup).toContain('data-viewer-toolbar="true"')
    expect(markup).toContain('class="viewer-toolbar-button"')
    expect(markup).toContain('data-viewer-toolbar-action="stock"')
    expect(markup).toContain('class="viewer-toolbar-icon"')
    expect(markup).toContain('class="viewer-toolbar-tooltip"')
    expect(markup).toContain('class="viewer-toolbar-divider"')
  })

  it('allows an application to render only its chosen controls in its chosen order', () => {
    const markup = renderToStaticMarkup(
      <ViewerToolbarProvider
        controls={{
          fit: { onClick: () => {} },
          banana: { pressed: true, onClick: () => {} },
        }}
      >
        <ViewerToolbar>
          <ViewerToolbar.Controls>
            <ViewerToolbar.FitButton />
            <ViewerToolbar.BananaButton />
          </ViewerToolbar.Controls>
        </ViewerToolbar>
      </ViewerToolbarProvider>,
    )

    const fit = markup.indexOf('data-viewer-toolbar-action="fit"')
    const banana = markup.indexOf('data-viewer-toolbar-action="banana"')
    expect(fit).toBeGreaterThan(-1)
    expect(banana).toBeGreaterThan(fit)
    expect(markup).not.toContain('data-viewer-toolbar-action="stock"')
    expect(markup).not.toContain('aria-pressed="false"')
    expect(markup).toContain('data-viewer-toolbar-action="banana"')
    expect(markup).toContain('aria-pressed="true"')
  })

  it('requires a provider for compound toolbar controls', () => {
    expect(() => renderToStaticMarkup(<ViewerToolbar.StockButton />)).toThrow(
      'useViewerToolbar must be used inside <ViewerToolbarProvider>',
    )
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
