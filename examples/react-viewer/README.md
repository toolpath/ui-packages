# React 3D viewer

A standalone, local-only Vite example for `@toolpath/viewer`. It renders procedural parts — a
one-inch (25.4 mm) cube by default, and a drilled plate, a chamfered block, a pocketed block, a
stepped boss and a toy brick from the model picker or `?model=plate|chamfer|pocket|boss|brick` — so it
requires no Toolpath API key or Engine request. The extra parts exist for the measure tool: they
have holes, chamfers, a pocket and a bore to snap to, and each page states what its dimensions
should measure.

The bottom toolbar offers stock, axes, grid, direction coloring, wireframe, Section, Measure, Fit,
Reset, and Top view. Stock is a box with an adjustable allowance (initially 3 mm per side);
its X × Y × Z dimensions appear in the sidebar. Use Fit after showing or resizing stock to
frame the whole blank. This allowance is a demonstration setting, not a recommended cutting allowance.

Direction mode colors the model and shows matching arrows and a clickable legend. Choosing a
direction scopes face picks; All clears that scope. Wireframe shows CAD face boundaries with
painted/hovered faces still visible. Section and Measure use the contextual panel above the
toolbar and switch cleanly between each other. The example owns these controls and uses only
the package's public API.

```bash
pnpm install --frozen-lockfile
pnpm --filter @toolpath/example-react-viewer dev
```

## Two pages, one build

The query string picks the camera and the pivot marker, because the package's
defaults and this example's are not the same:

| URL                         | What it shows                                                       |
| --------------------------- | ------------------------------------------------------------------- |
| `/`                         | A perspective camera. Picking, the section tool, panning, the cube. |
| `/?projection=orthographic` | The projection `@toolpath/viewer` itself defaults to.               |
| `/?orbitTarget=on`          | `showOrbitTarget` — two circles at the point the view turns about.  |
| `/?stock=on`                | Stock visible and framed on the opening view.                       |

The pin on the default page is deliberate: its click points were scanned by hand
off the rendered canvas, and a camera change moves every one of them. Each page
has its own scanned points and its own spec — `tests/viewer.spec.ts` and
`tests/orthographic.spec.ts`.

Run the browser acceptance tests with Chromium installed:

```bash
pnpm --filter @toolpath/example-react-viewer exec playwright install chromium
pnpm --filter @toolpath/example-react-viewer test
```
