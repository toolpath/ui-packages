# React 3D viewer

A standalone, local-only Vite example for `@toolpath/viewer`. It renders procedural parts — a
one-inch (25.4 mm) cube by default, and a drilled plate, a chamfered block, a pocketed block, a
square-cornered pocket, a stepped boss and a toy brick from the model picker or
`?model=plate|chamfer|pocket|sharp-pocket|boss|brick` — so it
requires no Toolpath API key or Engine request. The extra parts exist for the measure tool: they
have holes, chamfers, a pocket and a bore to snap to, and each page states what its dimensions
should measure.

The toolbar offers stock, axes, grid, direction coloring, wireframe, Section, Measure, Fit,
Reset, and Top view. Stock can be a box/cylinder preview or one of the bundled GLB blanks.
The sidebar controls dimensions and centered/top/bottom positioning for previews and reports
their size. Use Fit after showing or resizing stock to frame the whole blank. These values
are demonstration settings, not machine-stock recommendations.

Direction mode colors the model and shows matching arrows and a clickable legend. Choosing a
direction scopes face picks; All clears that scope. Wireframe shows CAD face boundaries with
painted/hovered faces still visible. Section and Measure use the contextual panel above the
toolbar and switch cleanly between each other. The example owns these controls and uses only
the package's public API.

```bash
pnpm install --frozen-lockfile
pnpm --filter @toolpath/example-react-viewer... build
pnpm --filter @toolpath/example-react-viewer dev
```

Run these commands from the repository root with its pinned Node/pnpm toolchain.
The build command includes the example's workspace dependencies; installation alone
does not create their `dist` output.

To see changes to `packages/viewer` while the example runs, keep `pnpm --filter @toolpath/viewer build:watch` going beside it.

## Sharp corners, on real parts

The **Sharp corners** button in the toolbar turns on `<PartMesh sharpCorners>`, which draws the
corners of the features the DFM rules flag, and nothing else. The sidebar's **Sharp corners** line
says how many segments are drawn and how long they are; `?sharp=on` opens with the button pressed.
With **feature hover** on as well, pointing at a corner draws it up and the hover card describes it:
the feature it is in, the angle between its walls, how deep it runs and which way it is cut — and, on
an Engine part opened with its datasheets, the widest tool that fits the feature.

**Square-cornered pocket** (`?model=sharp-pocket`) is built as one closed solid, the way the Engine's
meshes are, and its pocket is flagged by hand as the rules would flag it: its four corners up the
walls are drawn, and its floor edges, rim and outside edges are not. The other parts here have no
sharp corner, so the button draws nothing on them.

A real part shows the most. **Open an Engine part** takes a report `.json` and its `.glb` or `.stl`,
picked together, and reads them the way `<EnginePart>` does. For sharp corners, pick the features'
datasheets with them: one or more `.json` files as `GET /v1/parts/{id}/features` answers. Each
datasheet goes through the DFM rules' `featureSheet`, so a feature is flagged exactly where the rules
say. Nothing is uploaded or kept, and a reload forgets them.

## Two pages, one build

The query string picks the camera and the pivot marker, because the package's
defaults and this example's are not the same:

| URL                              | What it shows                                                       |
| -------------------------------- | ------------------------------------------------------------------- |
| `/`                              | A perspective camera. Picking, the section tool, panning, the cube. |
| `/?projection=orthographic`      | The projection `@toolpath/viewer` itself defaults to.               |
| `/?orbitTarget=on`               | `showOrbitTarget` — two circles at the point the view turns about.  |
| `/?stock=on`                     | Stock visible and framed on the opening view.                       |
| `/?stock=on&stockShape=cylinder` | Cylinder stock preview.                                             |
| `/?stock=on&stockSource=glb`     | A bundled GLB stock fixture.                                        |

The example pins its perspective default independently of the package's orthographic
default. Browser tests cover both projections and use a fixed viewport for canvas interactions.

Run the browser acceptance tests with Chromium installed:

```bash
pnpm --filter @toolpath/example-react-viewer exec playwright install chromium
pnpm --filter @toolpath/example-react-viewer test
```
