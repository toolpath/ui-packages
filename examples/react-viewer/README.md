# React 3D viewer

A standalone, local-only Vite example for `@toolpath/viewer`. It renders procedural parts — a
one-inch (25.4 mm) cube by default, and a drilled plate, a chamfered block, a pocketed block, a
square-cornered pocket, a stepped boss and a toy brick from the model picker or
`?model=plate|chamfer|pocket|sharp-pocket|boss|brick` — so it
requires no Toolpath API key or Engine request. The extra parts exist for the measure tool: they
have holes, chamfers, a pocket and a bore to snap to, and each page states what its dimensions
should measure.

The toolbar offers stock, axes, grid, direction coloring, wireframe, Explode, Section, Measure, Fit,
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

## Explode

The **Explode** toolbar button animates the loaded part's surfaces along candidate machining
approaches. Use the amount slider to scrub and **Color by: Feature / Direction** to change colors.
The transition respects reduced-motion preferences. Hover and click copies using the existing
feature card and selection readout. Selection highlights the original surfaces with one connector;
surface labels are omitted.

The layout merges readings with identical region sets and keeps partially overlapping readings
as separate copies. Its default approach and ordering are deterministic. **Feature** gives each
piece a stable color; **Direction** colors the same pieces by their chosen machining approach,
including approaches absent from the report's candidate list. Changing colors preserves pieces,
positions, selection, hover identities, and geometry buffers. These pieces describe candidate
readings, not calculated setups or disassembly instructions. Travel clears the part's projected
bounds, and copies sharing surfaces and an approach are separated along that approach.

Exploding, collapsing, scrubbing, and changing colors preserve the camera's position, target,
and zoom. Surfaces can move outside the viewport; use **Fit** or zoom out when you want to see
the whole layout. Collapsing keeps camera adjustments made while exploded.

Entering Explode leaves Section, Measure, direction coloring, wireframe, focus, and sharp-corner
display; feature hover is enabled. Choosing an assembled analysis/display mode returns to the
normal part first. Stock, axes, grid, and camera controls remain available. Reset or changing
parts closes Explode.

The example imports `ExplodedPart` and its primitive types from `@toolpath/viewer`.
The application owns grouping, chosen approaches, spacing, colors, animation state, and controls
in `src/explode/`; the package renderer receives region groups and offsets. It draws
open, double-sided surface copies and preserves original report identities for picking.
Source geometry is never translated, reordered, or disposed. The ordinary `PartMesh` stays mounted
and takes over again at stationary zero, preserving its ownership of region attributes.
Surfaces share one GPU batch and their outlines share one draw; batching preserves each piece's
source triangle map and independent picking. The example prepares shaders before enabling Explode
and retains buffers through collapse/reopen, releasing them when the part changes. Animation updates
instance transforms without rebuilding geometry. Slider and hover readouts update locally, and
animation updates React readouts at most ten times per second.

Layouts exceeding 512 groups or 1,000,000 copied triangles leave the original part visible.
The same rendering budget applies to both color modes. These are example policy limits, not
machining decisions made by the package. The new public exports need the next viewer release;
they are not available in published version 2.3.3.

After building the example, run its explode checks:

```sh
pnpm --filter @toolpath/example-react-viewer exec playwright test tests/explode-toolbar.spec.ts tests/explode-model.spec.ts --workers=1
```

For a real dense part, use the PC Housing v3 sample in `~/dev/cad-viewer/packages/core/sample/`.
Its `analysis.json` holds the Engine report under `report`; open that report and `mesh.glb`
together using **Open an Engine part**. PC Housing v3 has 403 feature
readings, producing 307 distinct feature pieces in either color mode. The CAD files stay
outside this repository; opening them makes no Engine requests and a reload forgets them.

The opt-in browser stress tests verify clearance, deterministic layout, feature-level picking,
selection preservation when recoloring, camera preservation, and repeated collapse/reopen.
The package's opt-in unit test verifies every copied triangle's position and source identity.
`explode-primitives.spec.ts` exercises the public renderer with application-defined IDs,
repeated surfaces, arbitrary translations, source-coordinate picks, and a bounded draw count.
The toolbar tests cover buffer reuse and shader preparation.

```sh
VIEWER_STRESS_SAMPLE_DIR="$HOME/dev/cad-viewer/packages/core/sample" pnpm --filter @toolpath/example-react-viewer exec playwright test tests/explode-stress.spec.ts --workers=1
VIEWER_STRESS_SAMPLE_DIR="$HOME/dev/cad-viewer/packages/core/sample" pnpm --filter @toolpath/viewer exec vitest run tests/explode-stress.test.ts
```

Build first; the tests run against the preview build. These tests use full
Chromium so the host GPU can be used where available. A passing interaction check alone is not
a frame-rate guarantee on other devices; geometry size, transparency, and GPU support still matter.

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
