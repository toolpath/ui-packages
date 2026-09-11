# React 3D viewer

A standalone, local-only Vite example for `@toolpath/viewer`. It renders a procedural one-inch
(25.4 mm) cube, so it requires no Toolpath API key or Engine request.

```bash
pnpm install --frozen-lockfile
pnpm --filter @toolpath/example-react-viewer dev
```

## Two pages, one build

The query string picks the camera and the pivot marker, because the package's
defaults and this example's are not the same:

| URL                         | What it shows                                                       |
| --------------------------- | ------------------------------------------------------------------- |
| `/`                         | A perspective camera. Picking, the section, panning, the view cube. |
| `/?projection=orthographic` | The projection `@toolpath/viewer` itself defaults to.               |
| `/?orbitTarget=on`          | `showOrbitTarget` — two circles at the point the view turns about.  |

The pin on the default page is deliberate: its click points were scanned by hand
off the rendered canvas, and a camera change moves every one of them. Each page
has its own scanned points and its own spec — `tests/viewer.spec.ts` and
`tests/orthographic.spec.ts`.

Run the browser acceptance tests with Chromium installed:

```bash
pnpm --filter @toolpath/example-react-viewer exec playwright install chromium
pnpm --filter @toolpath/example-react-viewer test
```
