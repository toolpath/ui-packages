# Orthographic projection in `@toolpath/viewer`

Bringing orthographic projection, zoom-to-cursor and double-click re-targeting
from the legacy Toolpath frontend into the published viewer package, one feature
at a time, with the DFM template as the live test bench — and ending with
orthographic as the default a consumer gets without asking, which is what the
legacy app has always done.

---

## The three repositories

| Role                        | Path                                                       | What happens here                                                                                                                                                                    |
| --------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Package under edit**      | `/Users/justingray/toolpath/new_code/toolpath-ui-packages` | All production changes. Package is `packages/viewer` (`@toolpath/viewer` 0.4.0). Every consumer-visible change needs a Changeset (`AGENTS.md`).                                      |
| **Dev server / test bench** | `/Users/justingray/toolpath/new_code/toolpath-template`    | `pnpm dev` runs here (`apps/dfm`, React Router + Vite, SSR off). The viewer is mounted at `apps/dfm/app/components/feature-viewer.tsx:708`. Only toolbar/plumbing edits belong here. |
| **Reference, read-only**    | `/Users/justingray/toolpath/toolpath_ui`                   | The legacy Next.js frontend. **Never edit.** Copy behaviour and intent out of it; do not copy its style.                                                                             |

Current branches: `jsg` (ui-packages), `jsg/review` (template, dirty with unrelated
work — preserve it).

### Reference files in the legacy repo

All paths under `/Users/justingray/toolpath/toolpath_ui/apps/frontend/src`:

| Behaviour                                                                 | File                                        | Lines                          |
| ------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------ |
| Ortho vs perspective camera construction                                  | `components/visualization/three-object.tsx` | `184-210` (`initializeCamera`) |
| Ortho frustum on resize                                                   | `components/visualization/three-object.tsx` | `458-506` (`handleResize`)     |
| Control tuning: zoom clamps, distance clamps, dolly speed, rest threshold | `components/visualization/three-object.tsx` | `289-311`                      |
| Start positions (ortho vs perspective)                                    | `components/visualization/three-object.tsx` | `25-26`, `314-319`             |
| `dollyToCursor` wiring + focal-offset reset on mode change                | `components/visualization/three-object.tsx` | `310`, `621-631`               |
| Target flash while zooming to cursor                                      | `components/visualization/three-object.tsx` | `565-596`                      |
| External zoom ↔ `camera.zoom` sync                                       | `components/visualization/three-object.tsx` | `598-619`                      |
| **Double-click to re-target**                                             | `components/visualization/part.tsx`         | `378-402`                      |
| Orbit-target helper sphere (the flash)                                    | `hooks/use-target.ts`                       | whole file                     |
| Legacy `ExtendedCameraControls`                                           | `lib/extended-camera-controls.ts`           | whole file                     |
| Control presets                                                           | `hooks/use-controls.ts`                     | whole file                     |

Note the legacy app defaults to **orthographic** (`isometric = true`,
`three-object.tsx:113`); only `pages/part-viewer.tsx:111` opts out. So the legacy
ortho path is the well-trodden one, and its perspective path is the exception.

---

## Where this stands — 2026-08-29

**Phases 0–6 are done and verified in the running app. Only Phase 7 is open.**
Phase 3 closed as a decision with no package behaviour change — see _What Phase 3
landed_. In Phase 7, **7.8, 7.9 and 7.10 are ticked — nothing is red in either
repository.** What is left is the release itself: 7.1–7.7, which is `pnpm check`,
the changesets, publishing, and unlinking the template.

Phase 7.8 was one package defect — see _The opening view was rolled_. 7.9 and
7.10 were what that defect showed was missing: **nothing in either repository
recorded what a click point hits**, so a camera that moved was reported by
whichever assertions happened to depend on a coordinate. Both now have a guard —
see _The click-point guards_.

### The template suite is green

`pnpm test:e2e` in the template: **145 passed** (144, plus 7.10's guard). `pnpm
check` in the template passes. The seven failures this document previously
carried are gone, and the spec's click coordinates were never touched — the fix
was entirely in the package.

### `examples/react-viewer` — was red, now green and guarded

`pnpm test:workspaces` in ui-packages used to fail two of the four tests in
`examples/react-viewer`:

- `selects a feature and responds to CAD camera navigation` — the direction
  arrow at 0.33 / 0.27 of the canvas was no longer on an arrow, so `Direction:`
  never left `all`.
- `finishing a drag over a face is not a request to select it` — the second
  click expected `back-face` and got `bottom-face`.

**They were Phase 6's, and they were the same casualty the template took.**
`examples/react-viewer/src/main.tsx` rendered `<Viewer>` with **no `projection`
prop**, so making orthographic the default moved the camera under a spec whose
coordinates were scanned by hand under perspective. Attributed by running the
same spec against three builds — ui-packages HEAD **4 passed**, HEAD + Phase 2–6
either side of the roll fix **2 failed** — so the roll fix neither caused nor
cured them, and they did not exist at HEAD.

**Closed by pinning the example to perspective**, the way the template's spec
does. `main.tsx` now passes `projection="perspective"` with the reason beside it:
this example is about picking, the section, panning and the view cube, and it
states the camera those are asked under. The alternative — letting the example
show the new default and re-scanning its coordinates — was the more honest demo
and was not taken, because it buys a demo of one prop at the price of leaving
four tests coupled to a camera in another package.

`pnpm --filter @toolpath/example-react-viewer test`: **5 passed**.

### The click-point guards — 7.9 and 7.10

The same guard now exists in both specs, because both had the same hole: the
click points were correct, and **nothing asserted what they hit**, so a camera
that moved was reported by its downstream victims rather than by name.

| Spec                                         | Guard                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `examples/react-viewer/tests/viewer.spec.ts` | First test in the file. `CENTRE`, `ONE`, `OTHER` and `ARROW` hoisted to module constants and named: `back-face`, `right-face`, `back-face`, and candidate direction `0`. The arrow assertion is a pair — the direction changes **and** the selection does not — because a point that has slid off the arrow onto the part behind it produces exactly the opposite pair. |
| `apps/dfm/tests/on-the-part.spec.ts`         | First test in the file. Reads region identity through Create, the only panel that names a region outright (`Take face <idx> off`): `FACE` is 0, `WALL` is 3, `OTHER` is 2, and three clicks make three rows, which is the distinctness the modifier and Create tests rest on.                                                                                           |

**Both were verified to fail for the right reason**, not merely to pass: removing
the example's `projection` pin puts its guard red first, at `Expected
"back-face", Received "front-face"`; flipping the template's stored preference to
orthographic puts its guard red on the missing `Face 0` row. A guard nobody has
watched fail is a guard nobody knows the shape of.

Two things the guards record that no assertion could before:

- **The coordinates depend on the viewer _build_, not only on the projection
  preference.** This is the fact nobody had written down, and the reason pinning
  the projection looked sufficient after Phase 6 — the rolled opening pose then
  moved the template's points with the pin in place. Both spec headers now say
  it.
- **`WALL` moved from region 3 to region 2 in the rolled build and nothing
  noticed**, because no test depends on its identity — only on it being a
  different face from `FACE`. The guard catches that case, which is the one
  where nothing else would have.

### The opening view was rolled — found by Phase 7.8, fixed

**Every part opened turned ~51° about the view axis, in both projections.**
Camera position, orbit target, distance, zoom and the clipping planes were all
exactly the fitted start pose. Only `camera.up` was wrong, which is why it read
as "the part is oriented oddly" rather than as a camera fault, and why the only
thing in either repository that reported it was a spec that clicks on faces.

Measured live out of the R3F root store on the dev server, published `0.4.0`
against the linked build, same app and same `projection="perspective"`:

|               | published 0.4.0                | linked build                 |
| ------------- | ------------------------------ | ---------------------------- |
| position      | `[214.360, 138.776, -210.799]` | identical                    |
| target        | `[25.4, 25.4, 25.4]`           | identical                    |
| distance      | 323.032                        | identical                    |
| zoom/near/far | 1 / 0.528 / 5279.291           | identical                    |
| **`up`**      | **`[0.627, 0.375, 0.683]`**    | **`[-0.003, 0.903, 0.431]`** |

Orthographic the same shape: `[-0.318, 0.662, 0.679]` became
`[-0.489, 0.564, 0.666]`. The published value is exactly `CAD_CAMERA_UP`
projected onto the plane perpendicular to the view — one clean orthogonalisation,
which is the intended result.

**Bisected by rebuilding the package and re-measuring:**

| Build                         | perspective `up`                  |
| ----------------------------- | --------------------------------- |
| full linked build             | `[-0.003, 0.902, 0.431]` — rolled |
| `applyLimits` neutralised     | `[0.627, 0.374, 0.683]` — clean   |
| clamps only, no `setBoundary` | `[0.627, 0.374, 0.684]` — clean   |
| `setBoundary` only, no clamps | `[-0.004, 0.903, 0.430]` — rolled |

`setBoundary` alone. The zoom and distance clamps were innocent.

**The mechanism, end to end:**

1. The `Viewer` resize effect re-applied `applyLimits(boundsRef.current)` on
   every `size` change — which fires at mount, before the mesh arrives, when the
   ref is still `defaultBounds()`: a unit sphere at the origin. For a part
   centred anywhere else that is a target boundary a few millimetres wide around
   a point the part does not contain.
2. `applyLimits` calls `setBoundary`, which marks `CameraControls` for update and
   so runs one **at the initial camera pose** — position `(1, -1, 1)` looking at
   the origin, which is the pose `CadCameraControls` builds and the opening frame
   is about to replace.
3. `#adaptUpVector` is registered on `update` — _every_ update, not just an
   orbit. It re-derived `up` from `(0, 0, 1)` against that throwaway view,
   giving `(-0.408, 0.408, 0.816)`.
4. The opening `frame()` then restored position and target exactly but never
   re-squared `up`: `resetContent` passed none, and Fit and Zoom-to omit it on
   purpose. So the re-derivation ran again on the already-rotated vector.

Projecting `(-0.408, 0.408, 0.816)` onto the final view plane gives
`(-0.0044, 0.9028, 0.4301)`. Measured: `[-0.003, 0.903, 0.431]`. The arithmetic
predicts the observation exactly.

`measure()` applying the limits made it worse in a second way: it put a
`setBoundary` at the _top_ of `frame()`, ahead of the look-at that frame exists
to perform, so even the first real framing ran an update at the outgoing pose.

**What the legacy viewer does, and why it never had this.** Three independent
reasons, all worth keeping in mind before adding anything else to the update
path:

- It **never calls `setBoundary`** — `grep` for it across the whole frontend
  returns nothing. The target boundary is this work's invention (F3).
- Its limits are set **once at construction** (`three-object.tsx:298-303`), never
  re-applied on a resize or a re-measure, and `handleResize` (`:458-506`) returns
  early until the geometry exists and then touches only the frustum, the
  projection matrix and the viewport.
- It **squares the up vector on every canonical pose**: `resetCameraPose`
  (`:404-431`) calls `resetUpVector()` and then passes `up: (0, 0, 1)` explicitly
  into `setCameraPose`, which copies it before the look-at.

Legacy's `adaptUpVector` is otherwise identical to the package's and is wired to
`'update'` the same way (`lib/extended-camera-controls.ts:135-153`), so the port
is faithful — the trap is inherited, and legacy survives it by never springing
it.

**The fix, in `@toolpath/viewer` — Changeset `.changeset/opening-view-roll.md`
(`patch`):**

- `measure()` measures and nothing else; it no longer applies limits as a side
  effect.
- `frame()` applies the limits **after** the look-at.
- The resize effect waits for the opening frame before applying limits. The
  frustum still tracks the viewport throughout, which is what stops a degenerate
  aspect.
- `resetContent()` passes `CAD_CAMERA_UP`, so the opening frame, Reset and the
  reframe on a projection switch are all square. Fit and Zoom-to still keep the
  orientation they were given, deliberately.
- `adaptedUp(view, up, into)` extracted into `render/camera.ts`, exported, and
  called by `ExtendedCameraControls` — so the sensor exercises the real code.

**The sensor.** `tests/camera.test.ts` pins three things: that `adaptedUp`
squares `CAD_CAMERA_UP` against the opening view to `0.626994, 0.376196,
0.682169`; that it is idempotent at a fixed view; and that it **carries the roll
of a pose the camera only passed through**, at this bug's own numbers
(`-0.004357, 0.902870, 0.429892`, 50.9° off). That third test is the one that
states, in the package, why a canonical pose has to declare its own `up`. The
package's Vitest is `environment: 'node'`, so this is the only shape the sensor
could take there — the ordering half is held by the template's e2e.

**Whose the seven template failures were.** This document previously recorded
them as pre-existing and as belonging to the unrelated in-progress
`part-inspector` / `plan-state` work. **Both were wrong**, and the correction is
kept here because the wrong version cost a re-investigation:

| Build                                               | `on-the-part.spec.ts`        |
| --------------------------------------------------- | ---------------------------- |
| template HEAD, published `0.4.0`                    | **30 passed**                |
| template working tree + published `0.4.0`           | 30 passed; points 0 / 3 / 2  |
| template working tree + linked build                | 7 failed; points 0 / 2 / 0   |
| template working tree + linked build, after the fix | **144 passed** (whole suite) |

The in-progress work is innocent — its `part-view` / `part-inspector` diff is
comments only, and the canvas measured 400 × 647 in every configuration.

### Finding a click point, and pinning it

The failure was legible only because seven tests happened to depend on one
coordinate. It should not have needed seven, and the method is worth keeping.

**Which region does a point hit?** Open the cube, go to Directions → `Not cut
yet`, click the point, and read the `title` of `[data-row][aria-expanded="true"]`
— it names the face outright (`Face 2, Plane, 2580.64 mm², …`). Three clicks
answer it for all three points, and `[aria-label^="Take face"]` inside Create
answers the same question from the other side.

**Pin what you find.** `on-the-part.spec.ts` has three module constants —
`FACE` (region 0), `WALL` (region 3), `OTHER` (region 2) — whose comments were
**correct** throughout; nothing checked them, so seven downstream failures said
seven different things instead of one saying "`OTHER` now hits region 0". Worth
noting that `WALL` moved from region 3 to region 2 in the rolled build and
**nothing noticed**, because no test depends on its identity — only on it being
a different face from `FACE`. A guard that asserts each point's region, and that
the three are distinct, catches the change twice over and names it.

**Done**, in both specs — see § _The click-point guards_. Each has the guard
test and the header sentence saying the coordinates depend on the viewer
**build**, not only on the projection preference, which is the fact nobody had
written down and the reason the pin to perspective looked sufficient.

### What is on disk, uncommitted

In `toolpath-ui-packages` (branch `jsg`), all Phase 2–6 work plus this document.
Rebuilt from `git status` rather than kept by hand, because two earlier attempts
to patch this table silently did nothing:

| File                                         | What changed                                                                                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/viewer/src/render/camera.ts`       | Phase 2 — `cameraLimits`, `targetBoundary`, `CameraLimits`, the frame ratios, the `nearFar` note. **7.8 — `adaptedUp`**                                                                |
| `packages/viewer/src/render/controls.ts`     | Phase 2 — `applyLimits`, `dollySpeed` 1.15, `restThreshold` 0.005. **7.8 — `#adaptUpVector` calls `adaptedUp`**                                                                        |
| `packages/viewer/src/camera.tsx`             | Phase 3 — the F9 decision at the `zoomTo` effect. Comment only, no behaviour                                                                                                           |
| `packages/viewer/src/render/retarget.ts`     | Phase 4 — new. `retargetPose`, the pure re-target transform                                                                                                                            |
| `packages/viewer/src/render/picking.ts`      | Phase 4/6 — `PartPick.doubled`, reported rather than interpreted                                                                                                                       |
| `packages/viewer/src/render/tap.ts`          | Phase 4/6 — `DoubleTapTracker.reset()`                                                                                                                                                 |
| `packages/viewer/src/part-mesh.tsx`          | Phase 4/6 — the paired-tap gesture, `doubled` on the pick, `reset()` on pointer-out                                                                                                    |
| `packages/viewer/src/render/target.ts`       | Phase 5 — new. The fade curve, the sizes, the two colours                                                                                                                              |
| `packages/viewer/src/target-marker.tsx`      | Phase 5 — new. The marker itself                                                                                                                                                       |
| `packages/viewer/src/viewer.tsx`             | Phases 2–6 — `applyLimits`, the F6 note, the retarget context, `showOrbitTarget`, **the projection default**. **7.8 — where the limits are applied, and `resetContent` squaring `up`** |
| `packages/viewer/src/index.ts`               | the new exports across all of it, `adaptedUp` included                                                                                                                                 |
| `packages/viewer/README.md`                  | `projection`, `retargetOnDoubleClick`, `showOrbitTarget`                                                                                                                               |
| `packages/viewer/package.json`               | `build:watch` — Phase 0 scaffolding, but it belongs to the package and can stay                                                                                                        |
| `packages/viewer/tests/camera.test.ts`       | `cameraLimits` and `targetBoundary`. **7.8 — the three `adaptedUp` tests**                                                                                                             |
| `packages/viewer/tests/tap.test.ts`          | `reset()`                                                                                                                                                                              |
| `packages/viewer/tests/retarget.test.ts`     | new                                                                                                                                                                                    |
| `packages/viewer/tests/target.test.ts`       | new                                                                                                                                                                                    |
| `examples/react-viewer/src/main.tsx`         | 7.9 — `projection="perspective"` on the `<Viewer>`, and why                                                                                                                            |
| `examples/react-viewer/tests/viewer.spec.ts` | 7.9 — the click-point guard, and the points hoisted to module constants                                                                                                                |
| `.changeset/orthographic-camera-clamps.md`   | `minor`                                                                                                                                                                                |
| `.changeset/retarget-on-double-click.md`     | `minor`                                                                                                                                                                                |
| `.changeset/orbit-target-marker.md`          | `minor`                                                                                                                                                                                |
| `.changeset/orthographic-by-default.md`      | **`major`** — and the whole release is major because of it                                                                                                                             |
| `.changeset/opening-view-roll.md`            | `patch` — 7.8, the opening-view roll                                                                                                                                                   |

In `toolpath-template` (branch `jsg/review`), Phase 1 and 3–6 work plus Phase 0
scaffolding. **The tree also holds unrelated in-progress work — `stable`,
`plan-state`, `panel-memo`, `reach`, `part-inspector` and `part-view`, plus
`AGENTS.md` and `docs/review-backlog.md`. Not part of this plan. Do not touch
them.**

| File                                                                     | What changed                                                                                                         | Phase 7 reverts? |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `apps/dfm/app/shared/projection.ts`, `projection.test.ts`                | new — the preference, orthographic by default                                                                        | no               |
| `apps/dfm/app/components/feature-viewer.tsx`                             | the projection toggle; `projection` and `showOrbitTarget` passed to `<Viewer>`                                       | no               |
| `apps/dfm/app/shared/selection.ts`, `selection.test.ts`, `picks.test.ts` | `doubled` on the picks the app synthesises                                                                           | no               |
| `apps/dfm/docs/interactions.md`                                          | the projection toggle, the two double clicks, the orbit marker                                                       | no               |
| `apps/dfm/tests/viewport-reach.spec.ts`                                  | `the part can be read flat, and it stays flat`, now orthographic-first                                               | no               |
| `apps/dfm/tests/on-the-part.spec.ts`                                     | pins its own projection; the wheel-preference, re-target, doubled and marker tests; **7.10 — the click-point guard** | no               |
| `package.json`                                                           | `pnpm.overrides` link                                                                                                | **yes**          |
| `pnpm-lock.yaml`                                                         | the link                                                                                                             | **yes**          |
| `apps/dfm/vite.config.ts`                                                | `resolve.dedupe`                                                                                                     | 7.5 decides      |

`apps/dfm/.env` exists locally, created by `node scripts/setup-local.mjs` so the
dev server would start. It is gitignored. Never read or print it.

### Getting the loop running again

1. `pnpm --filter @toolpath/viewer build:watch` in ui-packages, left running.
2. `pnpm dev` in the template, left running on :5173.
3. After a package source change, Vite serves a **stale pre-bundled dep** until
   its cache is dropped: kill the dev server, `rm -rf apps/dfm/node_modules/.vite`,
   start it again. A `504 (Outdated Optimize Dep)` in the console is this.

### How Phases 0–2 were actually verified, and how to verify 3–5

Screenshots alone cannot tell a working clamp from a lucky one. Drive the app
with Playwright against the `cube-fixture` report and read `camera` and
`controls` **live**, out of R3F's own root map:

```js
const url = performance
  .getEntriesByType('resource')
  .map((e) => e.name)
  .find((n) => n.includes('@react-three_fiber'))
const fiber = await import(url) // same module instance the app has
const state = fiber._roots.get(document.querySelector('canvas')).store.getState()
;(state.camera.zoom, state.controls.minDistance, state.controls.getTarget(new Vector3()))
```

`__r3f` is **not** on the canvas element — the `<Canvas>` subtree is a separate
reconciler, so the DOM route is a dead end. Importing the dep URL the page
already loaded gets the singleton. Counting distinct `three.js` dep URLs in
`performance.getEntriesByType('resource')` is also the cheapest proof that
`resolve.dedupe` is holding: one URL, one `three`.

**This works on the dev server only.** `_roots` is a named export nothing in the
app re-exports, so the production build tree-shakes it away and no chunk has it —
which is what the committed Playwright config runs against (`pnpm build` then
`server/prod.ts` on :4173). Drive a probe with a throwaway config pointing at
`react-router dev` instead, and match the dep URL on `@react-three_fiber` after
widening the resource filter past `.endsWith('.js')`: Vite's dep URLs carry a
`?v=` query.

A committed test therefore cannot read the camera. What it can read is pixels —
and `page.screenshot({ clip })` of the viewport is byte-stable between frames
here, which makes "the view did not move" a real assertion. Clip to a band: the
shelves, the view cube and the size readout are HTML laid **over** the canvas, so
`locator('canvas').screenshot()` catches them and a pressed toggle changes the
image on its own.

Anchoring is testable numerically — unproject the cursor onto the plane through
the orbit target before and after a wheel burst; anchored means the world point
under the cursor does not move.

### Isolating a change to the package, the template, or neither

Phase 7.8 needed to know whether seven red tests were the app's, the package's or
pre-existing, and guessing cost a wrong answer in this document. Three
throwaway worktrees answer it in a few minutes, and none of them touches a
working tree:

- **Template HEAD** — `git worktree add --detach <dir> HEAD`, `pnpm install
--frozen-lockfile`. No `pnpm.overrides`, so it resolves the _published_
  package. This is "does it fail without any of my work".
- **Template working tree + published package** — the same worktree, plus
  `git diff -- . ':!package.json' ':!pnpm-lock.yaml'` applied and the untracked
  new files copied in. This is "is it the app's changes".
- **Template working tree + an isolated package build** — as above, but with
  `pnpm.overrides` pointed at a _ui-packages_ worktree carrying its own
  uncommitted work, so the package under test can be edited and rebuilt without
  disturbing the real one. This is where a candidate fix gets measured.

A worktree needs its own `apps/dfm/.env`: run `node scripts/setup-local.mjs` in
it, which generates the secret into the file without printing it. Never copy the
real one, and never read either.

`git worktree remove --force <dir>` and `git worktree prune` when done —
they register in the parent repository and will otherwise be found later by
somebody who does not know what they were for.

### Open decisions, carried forward

- **F9 — what flipping `zoomTo` should reset.** Closed: nothing. F17 and F18 say
  the target is the middle of the screen and the flip already moves nothing, so
  every candidate reset is a pan. Recorded in `src/camera.tsx` and held by a
  template sensor. Phase 3 has no package code in it.
- **F6 — the projection switch resets the view direction.** Resolved as
  intended and recorded in `viewer.tsx`. Reopen only if the pose should survive
  the `Canvas` remount, which is its own change.
- **F15 — the grid's NaN geometry.** Real, pre-existing, projection-independent,
  and owned by no phase. Was out of scope here on purpose; closed since, on its
  own branch — see the F15 row below for what the cause actually was.

---

## What already exists in the package

Orthographic was roughly 80 % built and **had never been switched on by a
consumer**. `Viewer` still defaults to `projection="perspective"` — Phase 6 is
where that flips. Do not rebuild any of this:

| Already there                                                                                                                           | Location                         |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `Projection` type, `applyProjection`, `orthographicHalfHeight`, ortho `nearFar`, per-projection `START_DIRECTION`, `fitDistance`        | `src/render/camera.ts`           |
| `projection` prop, `Canvas key={projection}`, reframe-on-projection-change, ortho `zoomTo(1)` on Fit, ortho zoom ratio in `frameBounds` | `src/viewer.tsx`                 |
| Wheel → `ACTION.ZOOM` when the camera is orthographic                                                                                   | `src/render/controls.ts:222-226` |
| `dollyToCursor` driven by the `zoomTo` prop                                                                                             | `src/camera.tsx:94-101`          |
| Double **middle** click → Fit                                                                                                           | `src/viewer.tsx:199-210`         |
| `screenLength` already branches on `OrthographicCamera` (section handles stay pixel-sized)                                              | `src/render/section.ts:189-207`  |
| Ortho half-height / near-far coverage                                                                                                   | `tests/camera.test.ts`           |

What is genuinely missing: no way to turn it on, no zoom/distance clamps, no
focal-offset reset when `zoomTo` flips, no double-left-click re-target, no orbit
target helper.

---

## Phase 0 — Point the template at the local package

Nothing to design; this is the loop everything else depends on.

1. **Link the package.** In `/Users/justingray/toolpath/new_code/toolpath-template/package.json`
   add, at the top level:

   ```json
   "pnpm": {
     "overrides": {
       "@toolpath/viewer": "link:../toolpath-ui-packages/packages/viewer"
     }
   }
   ```

   `link:` in `pnpm.overrides` resolves relative to the workspace root, so that
   path lands on `/Users/justingray/toolpath/new_code/toolpath-ui-packages/packages/viewer`.
   Then `pnpm install --no-frozen-lockfile` from the template root.

2. **Deduplicate `three` — this is not optional.** A linked package resolves its
   own peer copies out of the _ui-packages_ store, so the app would run two
   `three` instances. Two failures follow silently, with no error:
   `CameraControls.install()` (`src/render/controls.ts:25`) would be given the
   wrong classes, and every `camera instanceof OrthographicCamera` check
   (`src/render/camera.ts:166`, `src/render/controls.ts:224`) would return
   `false` — which is exactly the orthographic path this work is about. Add to
   `apps/dfm/vite.config.ts`:

   ```ts
   resolve: {
     dedupe: ['three', 'react', 'react-dom', '@react-three/fiber', '@react-three/drei'],
   }
   ```

   Both repos pin `three` 0.185.1 and React 19.2.0, so dedupe is exact rather
   than a fudge.

3. **A rebuild loop.** The package's `exports` point at `dist/`, so a source edit
   is invisible until `tsup` reruns. Add a `build:watch` script to
   `packages/viewer/package.json` (the `build` command plus `--watch`, minus
   `--clean`) and leave it running beside the template's `pnpm dev`.

4. **Gate.** The app looks and behaves exactly as it did before, and
   `pnpm --filter @toolpath/dfm check-types` passes. If anything changed here,
   the link is wrong — stop and fix it before Phase 1.

5. **Remember to undo.** The override, the lockfile churn and (if it turns out to
   be link-only) the `dedupe` block are local scaffolding. They must not reach a
   commit on the template. Phase 7 reverts them.

- [x] 0.1 Add the `pnpm.overrides` link to the template root `package.json`
- [x] 0.2 Add `resolve.dedupe` to `apps/dfm/vite.config.ts`
- [x] 0.3 `pnpm install --no-frozen-lockfile` in the template
- [x] 0.4 Add `build:watch` to `packages/viewer/package.json`; run it
- [x] 0.5 `pnpm dev` in the template; confirm no visible change and `check-types` passes

---

## Phase 1 — Switch orthographic on, and find out what breaks

A probe, not a feature. **No package change in this phase** — the point is to
learn what the existing ortho path actually does under a real part before
changing any of it.

Template work only:

- `apps/dfm/app/shared/projection.ts` — a `Projection` preference with
  `loadProjection` / `saveProjection`, modelled exactly on
  `app/shared/zoom-to.ts` (same storage-key convention, same `Pick<Storage, …>`
  signature so it stays testable), plus `projection.test.ts` beside it.
- `apps/dfm/app/components/feature-viewer.tsx` — a `ToolButton` next to the
  existing zoom-to toggle (`feature-viewer.tsx:591-601`), and pass
  `projection={projection}` to `<Viewer>` at line 708.

Then exercise, and write findings into the § Findings section below rather than
fixing them inline:

- View cube panels and named views (does `squaredUp` still square the roll?)
- Fit, Reset, and feature zoom (`frameBox` → `frameBounds`, which takes a
  different ortho path at `viewer.tsx:159-161`)
- Section plane: handle size, the stencil cap, drag tracking
- Direction arrows, grid, axes, `PartSize`, the banana
- Wheel zoom with `zoomTo` on cursor and on centre
- Free orbit over the poles
- Container resize, and the sidebar collapse
- **The projection switch itself**: `Canvas key={projection}` (`viewer.tsx:399`)
  tears down and rebuilds the WebGL context. Confirm the geometry cache
  (`src/engine/geometry-cache.ts`) carries the mesh across, and note anything
  that resets which should not have.

- [x] 1.1 `app/shared/projection.ts` + `projection.test.ts`
- [x] 1.2 Toolbar toggle in `feature-viewer.tsx`, `projection` passed to `<Viewer>`
- [x] 1.3 Playwright: the toggle flips and persists (viewer toolbar spec)
- [x] 1.4 Walk the checklist above; record every defect under § Findings
- [x] 1.5 Order the findings, and fold them into Phases 2–5 before writing any package code

---

## Phase 2 — Orthographic camera correctness

First package change. Fixes whatever Phase 1 surfaced about the frustum, the
clipping planes and how far the camera may travel.

Reference: `three-object.tsx:184-210`, `:289-311`, `:458-506`.

Known deltas from legacy worth resolving deliberately:

- **Near/far.** Legacy uses `±largestDimension * 1000`
  (`three-object.tsx:196-197`); the package uses `±radius * 100`
  (`render/camera.ts:116`). The package's is the better-reasoned one — decide
  and record which wins rather than letting them differ by accident.
- **Zoom clamps.** Legacy pins `minZoom 0.25` / `maxZoom 10`. The package has
  none, so an ortho wheel zoom is unbounded in both directions.
- **Distance clamps.** Legacy pins `minDistance` / `maxDistance` off the part
  size. Under ortho these are what stop the camera walking through the part
  while the frustum, which is what actually controls apparent size, does not
  change.
- **Feel.** `restThreshold 0.005`, `dollySpeed 1.15`. The package already matches
  legacy's `smoothTime` (`DEFAULT_SMOOTH_TIME`, `render/controls.ts:69`).

Keep the arithmetic in `src/render/camera.ts` as pure functions so it is testable
under the package's `environment: 'node'` Vitest config; `src/render/controls.ts`
should only apply the numbers. Clamps derive from `SceneBounds`, so they need
re-applying wherever the bounds are re-measured (`viewer.tsx` `measure()`).

- [x] 2.1 Resolve the near/far discrepancy; record the reason in the source
- [x] 2.2 Pure zoom/distance clamp derivation in `src/render/camera.ts`
- [x] 2.3 Apply clamps + `restThreshold`/`dollySpeed` in `ExtendedCameraControls`
- [x] 2.4 Re-apply clamps when bounds are re-measured in `viewer.tsx`
- [x] 2.5 Extend `tests/camera.test.ts`; no `tests/controls.test.ts` — the only
      logic is the derivation, and it stayed in `camera.ts`
- [x] 2.6 Changeset (`minor`) — `.changeset/orthographic-camera-clamps.md`
- [x] 2.7 Verify in the template dev server before moving on

### What Phase 2 landed, measured in the template

|                               | Before                                                 | After                                   |
| ----------------------------- | ------------------------------------------------------ | --------------------------------------- |
| Orthographic, 60 notches in   | `zoom` 1.2e30, viewport empty                          | `zoom` 10, part fills the view          |
| Orthographic, 400 notches out | `zoom` 0.01, part one pixel                            | `zoom` 0.25, part a quarter of the view |
| Perspective, 30 notches in    | `distance` 2.5, camera inside the part, viewport empty | `distance` 34.49 = `minDistance`        |
| Perspective, 80 notches out   | unbounded                                              | `distance` 1379.77 = `maxDistance`      |
| Target after a long wheel-out | (2124, −2697)                                          | (137, 2), inside a 211 mm boundary      |

`dollySpeed` 1.15 and `restThreshold` 0.005 are live. F6 was resolved as a
**decision, not a fix**: the reset on a projection switch is intended, and the
reasoning — including that `Canvas key={projection}` would do it anyway — is
recorded at the reframe effect in `viewer.tsx`. Preserving the pose across the
switch would mean carrying it out through the teardown, which is its own change.

---

## Phase 3 — Zoom to cursor under orthographic

`dollyToCursor` is already wired (`src/camera.tsx:100`), but it has only ever run
against a perspective camera, where the wheel is `ACTION.DOLLY`. Under ortho the
wheel is `ACTION.ZOOM` (`render/controls.ts:222-226`) — a different code path in
`camera-controls` 3.1.0. Confirm it anchors on the pointer; if it does not,
implement the anchored ortho zoom by hand (offset the target by the world-space
delta the pointer ray sweeps as `camera.zoom` changes).

The one concrete legacy behaviour the package is missing:
`three-object.tsx:621-631` calls `setFocalOffset(0, 0, 0)` **before** flipping
`dollyToCursor`. Zoom-to-cursor accumulates a focal offset; without clearing it,
switching back to centre-zoom leaves the view permanently off-centre. Port that
into the `zoomTo` effect in `src/camera.tsx`.

- [x] 3.1 Confirm — in the browser — whether `dollyToCursor` anchors `ACTION.ZOOM`
- [x] 3.2 Not needed. F7 stands with the clamps in place; no hand-written ortho zoom
- [x] 3.3 Decided: `zoomTo` resets **nothing**, recorded at the effect in `src/camera.tsx`
- [x] 3.4 Sensor in the template (`tests/on-the-part.spec.ts`); no Changeset — no
      consumer-visible change, only a comment where the port would have gone
- [x] 3.5 Verified both projections × both `zoomTo` values in the template

### What Phase 3 landed

**No package behaviour changed, and that is the result.** F9 asked what flipping
`zoomTo` should reset. Both candidates were measured against the cube on the
running app, reading `camera` and `controls` live out of the R3F root store, and
both are wrong:

| Candidate reset  | Measured                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The focal offset | `getFocalOffset` reads (0, 0, 0) at every stage of a zoom, an orbit and a flip, in both projections, clamped and unclamped. The port would clear a zero. |
| The orbit target | The target projects to NDC (0, 0) at every one of those stages. It **is** the middle of the screen, so moving it pans the part.                          |

There is therefore no silent re-target available: a preference toggle that moves
the view is worse than a pivot sitting a few millimetres off the part. Putting
the pivot back belongs to a gesture that asks for it — Fit, or Phase 4's double
click.

The decision is recorded at the `zoomTo` effect in `src/camera.tsx`, and held by
`changing what the wheel zooms toward does not move the view` in the template's
`tests/on-the-part.spec.ts` — which was checked against a deliberate re-target
before being kept, so it fails on the change it exists to catch. It compares a
clipped band of the viewport rather than the canvas, because the shelves and the
view cube are HTML laid over it and the toggle repaints the very button the test
presses.

---

## Phase 4 — Double-click to re-target

Reference: `components/visualization/part.tsx:378-402`. Double-click on the part
raycasts, then moves the orbit target to the hit point and translates the camera
by the same delta — so the view does not jump, but everything afterwards orbits
and zooms about what was clicked. Under ortho, where the wheel scales a frustum
rather than moving the camera, this is what makes the viewport navigable at all.

The package already reserves this gesture: the comment at `src/viewer.tsx:190`
says double **left** click is "where a viewer usually puts 'orbit about this from
now on', and that is still to come", which is why Fit was put on the middle
button. Keep double-middle-click → Fit exactly as it is.

Design notes:

- Pure part in `src/render/retarget.ts`: `(cameraPosition, currentTarget, hitPoint)
→ { position, target }`. Node-testable, no three scene required.
- Reuse `trackDoubleTaps` (`src/render/tap.ts:91`) and the tap-slop guard — the
  same pairing the middle-click gesture already uses.
- **Do not add a second raycaster.** `EnginePart`/`PartMesh` already produce picks
  through `buildPick` (`src/render/picking.ts`); route the gesture through that
  path so the hit point comes from the same raycast the selection uses.
- Expose as a `Viewer` prop alongside `recentreOnDoubleClick` — e.g.
  `retargetOnDoubleClick`, defaulting on.
- The template's tap guard (`onPointerMissed`, `feature-viewer.tsx`) must not
  treat the second click as a selection change.

- [x] 4.1 `src/render/retarget.ts` (`retargetPose`) + `tests/retarget.test.ts`
- [x] 4.2 Wired through `PartMesh`'s existing `onClick` pick, gated on `retargetOnDoubleClick`
- [x] 4.3 Confirmed: the reading a double click opens is the one a single click opens, and Fit still recovers exactly
- [x] 4.4 Playwright in the template — two tests in `tests/on-the-part.spec.ts` against `cube-fixture.ts`
- [x] 4.5 Changeset (`minor`) — `.changeset/retarget-on-double-click.md`; prop documented in `packages/viewer/README.md`
- [x] 4.6 Verified in the template, both projections and both prop values

### What Phase 4 landed, measured in the template

`retargetPose(cameraPosition, currentTarget, hitPoint)` moves the target to the
point and the camera by the same delta, which is legacy's transform
(`part.tsx:378-402`) written as three vectors in and two out. Driven against the
cube on the dev server:

|                 | Orthographic                     | Perspective                  |
| --------------- | -------------------------------- | ---------------------------- |
| Target before   | (25.4, 25.4, 25.4) — cube centre | (25.4, 25.4, 25.4)           |
| Target after    | (28.275, **0**, 18.298)          | (**50.8**, 14.795, 3.662)    |
| Camera − target | unchanged, to three decimals     | unchanged, to three decimals |
| `camera.zoom`   | unchanged                        | unchanged                    |

The zeroes are the point: the cube spans 0–50.8, so the pivot landed exactly on
a face rather than near one. The preserved offset is what says only the pivot
moved — the part is the same size, seen from the same angle.

**Three interactions were checked rather than assumed.**

- _Selection._ A second click on a face already picked cycles to the next
  reading that owns it. Measured: click → `403a51fa…`, a second slow click →
  `93b39ca9…`. So the second click of the pair is swallowed, and a double click
  leaves `403a51fa…` — the same reading the single click inside it opened.
  Paired by hand rather than read off `dblclick`, which arrives _after_ the
  second `click` has been emitted and is therefore too late to hold it back.
- _The prop's off switch._ With `retargetOnDoubleClick={false}` the target does
  not move and the second click cycles the reading again, which is 0.4.0's
  behaviour returned intact.
- _Fit._ Double middle click after a re-target puts the target back on
  (25.4, 25.4, 25.4) exactly.

Both template tests were checked against the feature turned off before being
kept, and both go red there.

Design notes worth keeping: the viewer owns the policy and the part owns the
gesture, split over a `useRetarget` context that is `null` when the prop is off —
so the pairing itself is off at the source rather than detecting a gesture
nobody will act on. Nothing casts a second ray: the pivot is `event.point` from
the raycast the pick already ran.

---

## Phase 5 — Orbit-target helper (the flash)

Polish, and the thing that makes zoom-to-cursor and re-targeting legible: two
nested spheres at the orbit target, shown while a control gesture is active and
flashed on a zoom or a re-target.

Reference: `hooks/use-target.ts` (whole file) for the geometry, colours and
scaling; `three-object.tsx:565-596` for when it appears, and `:396-399` /
`:627-628` for the flashes.

Two things must change in the port:

- **Scale.** Legacy scales by `targetScaleFactor * partScale / camera.zoom`. That
  divisor is what keeps it a constant on-screen size under an ortho camera, where
  distance is meaningless. Keep it pure, in `src/render/target.ts`.
- **The fade.** Legacy fades with `setInterval` (`use-target.ts:79-87`). The
  package runs `frameloop="demand"`, so a timer-driven opacity change would
  update the material and never repaint. Drive the fade from `useFrame` +
  `invalidate()` instead.

Ship it off by default, or behind an existing aid toggle, so it cannot surprise a
consumer already on 0.4.

- [x] 5.1 `src/render/target.ts` (the fade curve and the sizes) + `tests/target.test.ts`
- [x] 5.2 `src/target-marker.tsx`, `EXCLUDE_FROM_FRAME`-flagged — `useContentBox` walks the whole scene, so this is load-bearing rather than tidy
- [x] 5.3 Up on `controlstart`, released on `controlend`, flashed whenever the target itself moves
- [x] 5.4 `showOrbitTarget` on `Viewer`, off by default; README; Changeset (`minor`) — `.changeset/orbit-target-marker.md`
- [x] 5.5 Verified in the template, on the aids switch beside the grid and the axes

### What Phase 5 landed

Three deliberate departures from the legacy port, each because looking at it
against a real part settled something the plan could not:

- **A dot inside a ring, not two nested spheres.** Legacy's outer sphere is
  depth-tested so the part burying it says the pivot is inside the material.
  Rendered, that reads as a fault rather than a signal: a pivot sitting _on_ a
  surface — which is exactly what Phase 4's double click produces, and the
  commonest case there is — cuts the sphere in half and leaves a lens-shaped
  smudge with the dot off to one side of it. The depth it reported is a question
  almost nobody asks; that it looked broken is something everybody would see.
  The ring is billboarded on the camera, so it is the same shape at every pose.
- **`screenLength`, not `partScale / camera.zoom`.** Legacy's divisor is right
  for an orthographic camera, where the frustum is the only scale, and wrong for
  a perspective one, where apparent size is a question about distance. The
  package already answers that for the section handle, and it answers it for
  both cameras.
- **Flashed on the target moving, not on `ACTION.ZOOM`.** `camera-controls`
  documents that the wheel emits no `controlstart` or `controlend` at all —
  scroll arrives intermittently and neither end can be detected — which is why
  legacy needed a separate zoom case. Watching the target itself covers the
  wheel, the double-click re-target and every programmatic move, with nothing
  having to tell the marker about any of them. It deliberately stays down for a
  centre-zoom, where the pivot is not moving and the frustum is scaling about
  the middle of the view, which is where the marker already is.

The fade is driven from `useFrame` + `invalidate` rather than a timer, which
`frameloop="demand"` makes mandatory: a `setInterval` writing an opacity changes
the material and repaints nothing.

**Colours are constants in `render/target.ts`, not `ViewerTheme` roles.** Adding
a required field to that interface breaks anybody who builds a whole theme by
hand, which is a `major` under ui-packages `AGENTS.md` and a steep price for an
aid that is off by default and on screen for a second at a time. They are
palette colours already in use, so the marker reads as part of the control
family; the roles can go in at the next major if a consumer asks, and nothing
about the module's shape changes when they do.

The template test presses on **empty space**, not on the part: the marker
appears at the pivot either way, because the camera always looks at the pivot,
and pressing off the geometry keeps hover, picking and selection out of the
pixels being compared. It was checked against the marker turned off before being
kept, and goes red there.

---

## Phase 6 — Make orthographic the default

Orthographic stops being the thing you switch on and becomes the thing you
switch off. It is what a machinist reads a part in — parallel edges stay
parallel, so a wall that looks square is square, and two features the same size
measure the same size wherever they sit. It is also what the legacy app has
always defaulted to (`isometric = true`, `three-object.tsx:113`); only one page
opted out. Perspective stays available, and stays the better answer for reading
a deep pocket as depth.

Deliberately last of the feature phases: the default should not change until the
orthographic path is the well-tested one. After Phases 2–5 it is.

**This is a `major` Changeset.** The `projection` default is public behaviour, and
every consumer who has never passed the prop gets a different camera. ui-packages
`AGENTS.md` puts a behavioural change of that kind on `major`, and this one
cannot be argued down to `minor`: nothing about the call site changes, which is
exactly what makes it easy to miss.

What it touches:

- `packages/viewer/src/viewer.tsx` — the `projection = 'perspective'` default at
  the `Viewer` destructure, and the `ViewerProps.projection` doc comment above it,
  which says "Perspective by default" in prose.
- `packages/viewer/README.md` — anywhere the default is stated.
- `apps/dfm/app/shared/projection.ts` — `loadProjection`'s fallback. It is
  written as "anything that is not the stored value is the default", so the
  comparison inverts rather than the shape changing.
- `apps/dfm/app/shared/projection.test.ts` — the "nothing has been said" case,
  and the "ignores anything it does not recognise" case, both of which name the
  default outright.
- `apps/dfm/tests/viewport-reach.spec.ts` — `the part can be read flat, and it
stays flat` asserts the first-visit label is `Perspective — press for
orthographic`.
- The toolbar label and glyph need no change: they already report whichever is
  in force rather than assuming one.

Two things to check rather than assume:

- **The stored preference of an existing user.** Nobody has `part-viewer.projection`
  set to `perspective` today, because the only way to store that value is to
  switch away from a default that was perspective. So flipping the fallback
  silently moves everyone to orthographic, which is the intent — but say so in
  the source, because the next reader will wonder whether it was considered.
- **`START_DIRECTION.orthographic`** (`render/camera.ts`) becomes the pose almost
  every user sees on almost every part. It has only ever been seen on purpose.
  Look at it against a real part before shipping the default, not after.

- [x] 6.1 Flipped the `Viewer` default and its doc comment; `README.md` updated
- [x] 6.2 Flipped `loadProjection`'s fallback and its tests, with a third for the reader who already had orthographic stored
- [x] 6.3 Updated the Playwright first-visit assertion
- [x] 6.4 Looked at `START_DIRECTION.orthographic` against the cube, portrait and landscape. **It stands** — see below
- [x] 6.5 Changeset (`major`) — `.changeset/orthographic-by-default.md`
- [x] 6.6 Verified in the template: nothing stored arrives orthographic, the toggle reaches perspective and stores it, a reload keeps it, and pressing again stores orthographic

### 6.4 — the opening pose stands

`[1.2, -2.5, 3]` normalises to 47° above the ground plane and 64° round from
+X, so it is a **trimetric** rather than an isometric: higher and more front-on
than `cadViewDirections.isometric`, and the three faces come out unequal. That
is a convention rather than a miss — it is what SolidWorks opens in — and
rendered against the cube it is a clean front-top-right three-quarter with the
view cube reading TOP / FRONT.

Worth recording: the **perspective** start pose is the odd one. `[2, 1.2, -2.5]`
is behind and below the part, and the view cube reads BOTTOM / BACK. So flipping
the default does not only change the projection, it moves the opening view from
the part's underside to its top. That is an improvement, and it is also the
mechanism behind everything in the next section.

### What Phase 6 cost, and what it found

The flip itself is four lines. What it broke was everything downstream that had
quietly been depending on where the part happened to be.

**Six Playwright tests began clicking faces they were never written about.**
`on-the-part.spec.ts` holds three canvas coordinates scanned off the rendered
image, and its own header said they were scanned — but nothing recorded that
they were coupled to a camera default in another repository. The two opening
poses look at opposite sides of the cube, so `FACE`, `WALL` and `OTHER` landed
on different regions with different readings. **The spec now pins its own
projection**, which is the fix worth having: what that file is about is what a
click means, and the camera is incidental to it. The tests that _are_ about the
camera set their own.

**And it surfaced a real regression in Phase 4**, which nothing had caught
because the two failures it caused were hidden among the seven this tree was
already carrying. Two clicks on one face, fast and in the same place, were being
paired as a double click and the second pick withheld — but the app gives that
gesture a meaning: in Edit Feature, clicking a face puts it in and clicking it
again takes it out. Two fixes, both in the package:

- **A trip away from the part breaks the pair.** Clicking a face, pressing
  something in a panel and clicking the same face again is three gestures, and
  the clock cannot tell it from two — it lands well inside the 400 ms window at
  the same coordinate. `DoubleTapTracker.reset()` is how a caller says so, and
  `PartMesh` calls it on `onPointerOut`.
- **The second pick is no longer withheld.** `PartPick` gains `doubled`, and
  the decision goes back to the app — the same bargain `modifiers` already
  makes, and for the same reason: a list that walks a face's readings and an
  editor that toggles a face both want something different from a second click,
  and the viewport cannot tell which it is serving. Phase 4's own template test
  asserted the withholding and has been rewritten to assert the opposite.

`PartPick.doubled` is required rather than optional, which breaks anybody
synthesising a pick — the template does, in three places. That is consistent
with `modifiers`, and the release is `major` regardless.

After all of it the suite is back to the seven failures this tree was carrying
before any of this work started, all of them in the unrelated in-progress
`part-inspector` / `plan-state` changes. 137 pass.

---

## Phase 7 — Land it

- [ ] 7.1 `pnpm check` in ui-packages (`openapi:verify`, `generate:check`, lint, build, types, test).
      **Needs Docker running** — `generate:check` shells out to the OpenAPI
      generator container and dies without it, which is unrelated to any of this
      work. `lint:js`, `check-types` and the viewer's own 237 unit tests pass,
      and `test:workspaces` is green now that 7.9 is closed
- [ ] 7.2 Confirm a Changeset exists for every consumer-visible change, and that the release is `major` because Phase 6 is
- [ ] 7.3 Publish / version `@toolpath/viewer`
- [ ] 7.4 **Revert the template link**: remove `pnpm.overrides`, restore `pnpm-lock.yaml`, bump `@toolpath/viewer` in `apps/dfm/package.json` to the published version, `pnpm install --frozen-lockfile`
- [ ] 7.5 Decide whether `resolve.dedupe` in `apps/dfm/vite.config.ts` stays (harmless and arguably correct) or goes with the link
- [ ] 7.6 `pnpm check` in the template against the published package
- [ ] 7.7 Update `apps/dfm/docs/README.md`: the projection toggle is new, and after Phase 6 the camera a first visit gets is different from the one it documents
- [x] 7.8 **The 7 failing template e2e tests.** One package defect — the opening
      view arrived rolled — not test rot and not the unrelated in-progress work.
      Fixed in the package; the template is 144 green with its coordinates
      untouched. See § _The opening view was rolled_
- [x] 7.9 **The 2 failing `examples/react-viewer` tests.** Phase 6's. Closed by
      pinning the example's `<Viewer>` to `projection="perspective"` and adding
      the click-point guard to its spec. 5 passed — see § _The click-point
      guards_
- [x] 7.10 **The template's guard test.** `FACE` 0, `WALL` 3, `OTHER` 2, read
      through Create, plus the header sentence saying the coordinates depend on
      the viewer **build** rather than only on the projection preference. Both
      guards were watched fail before being kept — see § _The click-point
      guards_

---

## Guardrails

- `/Users/justingray/toolpath/toolpath_ui` is **read-only**. Nothing is written there.
- Legacy is a reference for _behaviour_, not for code. It uses `THREE.*` namespace
  imports, class-field arrow overrides that shadow base methods (see the note at
  `src/render/controls.ts:75-86` — that shadowing was a real bug), `any`, and has
  no tests. ui-packages style and the existing `ExtendedCameraControls` win every
  time they disagree.
- One phase at a time: package change → test → changeset → **verified running in
  the template** → next phase. Do not stack two unverified phases.
- The template working tree has unrelated in-progress work on `jsg/review`.
  Preserve it; stage explicit paths only.
- Every phase that changes `packages/viewer/src/` needs a Changeset in the same
  change (ui-packages `AGENTS.md`).

---

## Findings

Phase 1, 2026-08-28. Driven against the `local-0.3.0-cube` fixture (50.8 mm cube,
six planar faces) on the template dev server, reading `camera` and `controls`
live out of the R3F root store rather than from screenshots alone.

Phase 0 verified first: the page loads exactly one `three.js` dep URL, so the
`resolve.dedupe` block is doing its job and there is a single `three` instance —
without it every finding below would have been an `instanceof` failure instead.

### Blocking — the wheel can put the viewer somewhere it cannot be read

| #   | Observation                                                                                                                                                                                                                                                                                                                   | Phase |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| F1  | **Orthographic zoom-in is unbounded.** 60 wheel notches reach `camera.zoom` 1.2e30 and the viewport goes empty — no part, no cue. `maxZoom` is `Infinity`.                                                                                                                                                                    | 2     |
| F2  | **Perspective has the same hole from the other end.** `minDistance` is 2.2e-16 and `maxDistance` is `Infinity`, so eight cursor-zoom notches put the camera 2.5 mm from its target, inside the part, and the viewport is empty. The clamps are not an orthographic-only fix — Phase 2 must set both pairs for both cameras.   | 2     |
| F3  | **The wheel keeps panning after the zoom clamp bites.** Zooming out stops at camera-controls' own `minZoom` 0.01 (the part is one pixel), but the target goes on walking with the cursor: 40 notches put it at (2124, −2697) for a part spanning 0–50.8. A distance clamp does not catch this; the target needs bounding too. | 2     |
| F4  | Fit recovers from all three — `zoomTo(1)` and a re-frame put it back exactly. But Fit is on double **middle** click, which nothing on screen advertises, so recovery is not the answer to F1–F3.                                                                                                                              | 2     |

### Feel

| #   | Observation                                                                                                                                                                                                                                                                                                                                                                                            | Phase |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| F5  | `dollySpeed` is 1 against legacy's 1.15, and `restThreshold` 0.01 against legacy's 0.005. Five notches take orthographic from `zoom` 1 to 21.7 — with legacy's 0.25–10 clamps the _entire_ usable range is 40×, so the current step size is only tolerable because nothing bounds it. Set the clamps and the speed together or the first notch will overshoot the whole range.                         | 2     |
| F6  | **Switching projection throws away the view direction.** `Canvas key={projection}` remounts, so the camera arrives at that projection's `START_DIRECTION` — the reset effect at `viewer.tsx:236` is not even what does it. Somebody who has orbited to a face loses it on every switch. Decide whether this is intended; if it is, say so in the source, because it looks like a bug from the toolbar. | 2     |

### Phase 3 is smaller than the plan assumed

| #   | Observation                                                                                                                                                                                                                                                                                                                                                                                                                   | Phase |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| F7  | **`dollyToCursor` already anchors `ACTION.ZOOM`.** The world point under the cursor drifted 0.08 mm across a 21× orthographic zoom, which is the smooth-time tail rather than a mis-anchor. 3.1 is answered and 3.2 is not needed — no hand-written anchored ortho zoom.                                                                                                                                                      | 3     |
| F8  | **The focal-offset port would be a no-op.** `focalOffset` reads (0, 0, 0) through every cursor zoom in both projections: camera-controls 3.1.0 anchors by moving the **target**, not by accumulating an offset, so legacy's `setFocalOffset(0, 0, 0)` at `three-object.tsx:621-631` is fixing a behaviour this version does not have.                                                                                         | 3     |
| F9  | The symptom legacy was treating is real here, with a different cause. After a cursor zoom the target is left on the point last zoomed at — (60.5, 19.0, 50.4) for a part spanning 0–50.8 — so flipping to centre-zoom afterwards orbits and zooms about a point off the part. What Phase 3 owes is _re-targeting_, not an offset reset, which makes Phase 4 the real fix and 3.3 a decision about what `zoomTo` should reset. | 3, 4  |

### Phase 3, re-measured with the Phase 2 clamps in place

| #   | Observation                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Phase |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| F17 | **The orbit target is always the middle of the screen.** Projected to NDC it reads (0, 0) at the start pose, after a twelve-notch cursor zoom, after an orbit, and either side of a `zoomTo` flip — in both projections. `CameraControls` derives the camera position from the target, so this is structural rather than a coincidence of the poses tried.                                                                                                    | 3     |
| F18 | **Flipping `zoomTo` moves nothing.** Camera position, target, zoom and focal offset are identical to three decimals either side of the toolbar press. F8's reading holds with the clamps in place: `focalOffset` is (0, 0, 0) throughout. Together with F17 this answers F9 — there is no reset to make that would not be a pan.                                                                                                                              | 3     |
| F19 | **`_changedZoom` strands at the orthographic zoom clamp** and is never drained: it is consumed by `_zoom - _lastZoom`, which is zero once the zoom is pinned. Measured at 10.296 across an orbit and idle frames with no target drift — a zero delta makes the block a no-op — and the next wheel notch zeroes it through `zoomTo` anyway. Left alone, because fixing it would mean writing a private field of `camera-controls` to remove a per-frame no-op. | out   |

### Already correct under orthographic — no work needed

| #   | Observation                                                                                                                                                                                                                               | Phase |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| F10 | `squaredUp` still squares the roll: a cube-panel click lands `up` on exactly (0, 1, 0) with the camera on axis.                                                                                                                           | —     |
| F11 | The section handle stays pixel-sized and the cut tracks the slider identically in both projections, so `screenLength`'s `OrthographicCamera` branch holds.                                                                                | —     |
| F12 | Grid, axes, direction arrows, `PartSize` and the banana all render correctly, and the banana's `frameBox` → `frameBounds` orthographic path frames part and banana together (`zoom` 0.374).                                               | —     |
| F13 | The geometry cache carries the mesh across the projection switch: one `/mesh` request before and after, and the part is on screen immediately.                                                                                            | —     |
| F14 | The frustum tracks the viewport on resize. `left`/`right` stay at ±radius while `top`/`bottom` follow the aspect — that is `orthographicHalfHeight` fitting on width for a portrait viewport, which is correct rather than a stuck value. | —     |

### Found by Phase 7.8

| #   | Observation                                                                                                                                                                                                                                                                                                                                                                     | Phase  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| F20 | **The opening view arrived rolled ~51°, in both projections.** `setBoundary` marks the controls for update, `#adaptUpVector` runs on every update, and the two ran together while the camera was still at its unframed pose. Position, target, distance and zoom were all exactly right, so nothing but a click test could see it. Fixed — see § _The opening view was rolled_. | 7.8    |
| F21 | **`adaptedUp` is a projection, so the up vector is path-dependent.** A camera carries the roll of every pose it has passed through, and nothing re-squares it unless a caller says so. That is why a canonical pose has to state its own `up`, and why the fix is two changes rather than one. Pinned by `tests/camera.test.ts`.                                                | 7.8    |
| F22 | **`examples/react-viewer` had the same camera coupling the template had**, and no pin. `main.tsx` passed no `projection`, so Phase 6 moved its hand-scanned coordinates and two of its four tests went red. Closed — pinned to perspective and guarded, 7.9.                                                                                                                    | 6, 7.9 |
| F23 | **Nothing checked what either repository's click points hit.** All three template comments were correct, and `WALL` still moved from region 3 to region 2 unnoticed, because only its distinctness from `FACE` is depended on. Seven tests failed saying seven different things. Closed — a guard in each spec, 7.9 and 7.10.                                                   | 7.10   |

### Pre-existing, projection-independent — out of scope, recorded so it is not re-found

| #   | Observation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Phase  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| F15 | Turning the scene aids on logs `THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN` once, in **both** projections. `gridSpec` runs against an empty `Box3` on the first render. The cause recorded here was wrong: `Box3.getCenter` and `getSize` both short-circuit to zero for an empty box, so the centre is fine and the step and extent look ordinary. It is `z`, taken straight from `box.min.z`, which is `+Infinity` — `gridGeometry` then builds every vertex on a plane at infinity. Closed — `gridFor` draws nothing until the box is real, and `openViewer` fails any spec whose mount reaches the console. | closed |
| F16 | The initial camera arrives rolled in both projections — `up` is (0.63, 0.37, 0.68) under perspective and (−0.32, 0.66, 0.68) under orthographic, never `CAD_CAMERA_UP`. Free orbit re-derives `up` from the start pose and the initial frame passes no squared `up`.                                                                                                                                                                                                                                                                                                                                                                      | out    |

### What this changes in the phases ahead

1. **Phase 2 grows and comes first.** F1–F3 are the only findings that leave the
   viewer unreadable, and F3 says the clamp set is wider than the plan listed:
   zoom, distance **and** the target. F5 ties `dollySpeed` to the clamps, so they
   land together. F2 makes Phase 2 a perspective fix as much as an orthographic
   one, which the plan did not anticipate.
2. **Phase 3 shrinks to a decision.** F7 retires 3.2 and F8 retires 3.3 as
   written. What is left is F9: deciding what flipping `zoomTo` should do about
   a target parked off the part.
3. **Phase 4 gains weight.** F9 means double-click re-targeting is not polish —
   it is the only gesture that puts the orbit target back on the part without a
   full re-frame, which is what makes the wheel survivable at all.
4. **Phase 5 is unchanged**, and F4 argues for it: the flash is what would have
   made every runaway above legible while it was happening.
5. **F6 is a decision, not a defect**, and belongs in Phase 2 beside the camera
   work — either preserve the direction across the switch or record why not.
6. **Nothing here argues against making orthographic the default** (Phase 6).
   F10–F14 say the orthographic path is already correct everywhere it was
   suspected of not being — named views, the section handle, the scene aids, the
   banana's framing, the frustum on resize — and F1–F3, the findings that made
   it unusable, are the ones Phase 2 closed. What is left before the default can
   flip is F9's target behaviour and Phase 4's re-targeting, which is why the
   default goes last rather than first.
