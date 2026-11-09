# @toolpath/api

## 0.20.0

### Minor Changes

- 01ca5bb: Regenerate the TypeScript SDK for Engine API 1.44.0.

  ### Engine API 1.44.0

  A file's shapes say where each copy sits. **Inspect a file** now reads a file's copies from its own
  assemblies: a body an assembly places more than once is one shape, with a placement for each.

  **Files** (experimental):

  - `FileShape.placements` on `GET /v1/files/{id}` and `POST /v1/files/{id}/parts`: one
    `FileShapePlacement` per copy, `{ body, placement }`. `placement` is a frame, absolute, in the
    file's coordinates and in mm, that carries a point of `body`, as **Get file mesh** draws it, to
    where the copy sits. Each is one of the file's own assembly placements, in the file's order, so
    always a rotation and a translation, never a mirror image or a scale. The first is where the body
    was loaded, at the identity.
  - `FileShape.count` is the length of `placements`, so it now counts a body an assembly places more
    than once once for each placement. It was one for each body.
  - Behaviour change: `FileBody.shape` is now each body's own `index`, and each shape has one body.
    Bodies modelled separately are separate shapes, however alike: three identical inserts modelled
    side by side are three shapes of `count` 1, where they were grouped as one shape of `count` 3 by
    their mass properties. A mirror image or a scaled copy of a body is never the same shape.

  Known limits:

  - Copies are only those the file's assemblies place. Identical bodies modelled separately are not
    matched, so a quote reads each as its own shape.
  - `placements` lists every copy inline, with no pagination, however many copies a file holds.

  Files inspected before this release are not re-read: their shapes and counts are as they were,
  grouped by mass properties, and each of a shape's bodies is listed once in `placements`, at the
  identity placement of its own `body`.

## 0.19.0

### Minor Changes

- Regenerate the TypeScript SDK for Engine API 1.43.0.

  ### Engine API 1.43.0

  A file's bodies have thumbnails. **Inspect a file** renders one for each of the first 200 bodies, and
  a new route lists them all in one request.

  **Files** (experimental):

  - `GET /v1/files/{id}/thumbnails` (`getFileThumbnails`): a 15-minute URL for the PNG thumbnail of each
    body that has one. 409 before the file has been inspected, 410 past the retention window.
  - `FileBody.hasThumbnail` on `GET /v1/files/{id}`: whether the body has a thumbnail. Rendering is
    best-effort, and false for every body of a file inspected before this release.

## 0.18.0

### Minor Changes

- d13196a: Regenerate the TypeScript SDK for Engine API 1.42.0.

  ### Engine API 1.42.0

  A part, a file and a holder are each one upload. The first request that acts on the source pins it
  to the upload it finds. A later request that finds a different one is refused rather than run, so
  results can no longer describe a file the part does not hold. No request or response field changes.

  **Upload URLs** (`POST /v1/parts`, `POST /v1/files`, `POST /v1/holders`) work as before, and an
  upload may be repeated until work is first asked of it. Once work has started on a source,
  uploading to it again is not supported, even of the same file. A changed source used to be read
  silently, and is now refused on the next request. To upload again, create a new part, file or
  holder.

  **New 409 codes**, each to be answered by creating a new part, file or holder:

  - `part_source_changed`: **Analyze a part**, **Analyze part features**, **Tessellate a part for
    display**, **Create a plan**, **Calculate toolpaths** and **Calculate a plan’s toolpaths**.
  - `file_source_changed`: **Inspect a file** and **Make parts from a file**. Parts of a file inspected
    from this release on are only made from the upload it was inspected from.
  - `holder_source_changed`: **Import a tool holder**.

  A refused call is not metered. A retry with the Idempotency-Key of a job already queued still
  answers with that job.

  **Jobs**: a job whose source was replaced after it was queued fails at once, with an `error`
  beginning `source_changed:`, is not retried and is not charged.

  **Analyze part features** now answers `part_not_uploaded` when the source is gone from storage,
  rather than queueing a job that fails.

  Existing parts, files and holders are not backfilled. An existing part or holder, or a file not yet
  inspected, is pinned by the next request that acts on it. A file inspected before this release is
  not pinned, and **Make parts from a file** copies its source as before.

## 0.17.0

### Minor Changes

- a104f11: `waitForJob`'s `reconnect` takes four more options for a server that watches many jobs, and Python's `WaitForJobReconnect` the same: `jitter` varies each wait by up to that fraction, only ever lengthening a `Retry-After`; `stableMs` (`stable_after`) starts the delays over only after a stream that stayed open that long; `quietMs` (`quiet_after`) treats a stream that has sent nothing, keep-alives included, for that long as lost; and `lookOnLoss` (`look_on_loss`) reads the job once when a stream is lost, settling the wait if it is final. The client argument may also be a function, called before each stream and each look, so a long wait can change its key; a refused key still ends the wait. A new `onStream` (`on_stream`) option reports each stream as `open` and, when reconnecting, `lost`. A `jitter` outside 0 to 1 is refused (`RangeError`, `ValueError`), and a look answered with a longer `Retry-After` than the next delay waits that instead. Without them both behave as before.

## 0.16.1

### Patch Changes

- 390eb75: Regenerate the TypeScript SDK for Engine API 1.41.1.

  ### Engine API 1.41.1

  tp-kernel 0.32.1. No field or shape changes: the descriptions of `BullnoseCurve`, `PinchPoint.point`,
  `FeatureDatasheet.pinchPoints` and `CdData.measurementFailed` change to say how a three-dimensional
  surface's clearance is now measured.

  **Feature datasheets**:

  - A three-dimensional surface's `cd` comes from the tool search that gives its `bullnoseCurve`, not
    from slices of the part. Its minimum is the widest tool reaching all of the surface out to its
    edges, so a chamfer or fillet that runs into a wall is held to the gap the wall leaves. Its
    maximum is the widest flat reaching a tenth of it. Its `pinchPoints` sit where that tool is
    stopped, and `bullnoseCurve` gains the corners 0.0762 and 0.127.
  - A part analyzed before this release keeps its readings until it is analyzed again.

  **Plans** (no change of shape):

  - A wall finish stops 0.00254 mm above its finished floor, or at the axial stock to leave where
    that is less. It used to cut down to the floor.
  - A ring floor narrower than its flat endmill, a counterbore's among them, is finished with one lap
    wherever a lap covers it. It was area-cleared, which could find nothing to cut.
  - A `planSpec` read under an earlier kernel fails as `stale_regions:` where this release prepares
    the part otherwise.

  **CAM export** (`camExportUrl`, experimental):

  - A refused pass states how far it got beside its reason: its heights and tactic where it was
    planned, and its toolpath where it was refused for what that does.

  **Operations**:

  - Deploy workers, then the API.

## 0.16.0

### Minor Changes

- a01c765: `@toolpath/api` has a `default` export condition beside `import`, and exports `./package.json`, so a
  resolver that asks for `require` (Jest under `jest-expo`, say) finds the package. The files are still
  ES modules only: a plain Node `require()` of them needs Node 20.19+ or 22.12+. The Python SDK's
  version moves with this release; its code is unchanged.

## 0.15.0

### Minor Changes

- 03edde8: Regenerate the TypeScript SDK for Engine API 1.41.0.

  ### Engine API 1.41.0

  A plan can be stated by region index: `planSpec`, experimental, in place of `setupPlan` and
  `doneRegions`. Every new plan serves its completed spec, which can be edited and sent back.

  **Plan and toolpath requests** (`POST /v1/parts/{id}/plans`, `POST /v1/parts/{id}/toolpaths`,
  `POST /v1/plans/{planId}/toolpaths`):

  - `planSpec` (experimental, `PlanSpec`): the region space its indices are in (`preparationId`), the
    regions the plan skips, the setups it starts with in order, the regions no other setup may
    machine, and the features each setup must machine, each by its `regions`; `additionalDirections`
    limits the directions the planner may add setups in. A field left out takes its default. A spec
    holds at most 20,000 region indices over all its lists. The 202 echoes it.
  - `preparationId` is copied from the response the indices were read from: the part, or a plan's
    `planSpec`. A job that prepares the part otherwise — a later kernel release that numbers its
    regions differently, or another source file — fails as `stale_regions:`.
  - A feature's `featureType` (one of the milled feature types, in the snake_case of a part feature's)
    restates a feature as it is listed: a type can say more than its regions do, and a profile's
    regions alone read as a wall. Left out, as for a listed feature's regions edited, the regions are
    read as the narrowest type they make.
  - A part feature holding a region the spec names — a skipped one, one exclusive to a setup of
    another direction, or one of a stated feature — is planned as what is left of it, and the plan's
    `trimmedFeatures` describes it.
  - A `planSpec` beside a non-null `setupPlan` or `doneRegions` is refused (400).
  - A statement the kernel cannot honor fails the job as `refused_plan_spec:`, with one clause per
    refused statement, located as `setup 1:`, `setup 1: feature 0`, `additional direction 0:` or
    `the plan spec:`.
  - A `refused_user_plan:` clause lists at most 20 regions, then counts the rest, as a
    `refused_plan_spec:` clause does.
  - **Calculate a plan's toolpaths** carries the plan's `planSpec` whatever else the request changes:
    omit to keep it, null to clear it. A request stating a `planSpec` drops the plan's `setupPlan` and
    `doneRegions`, and one stating either of those drops its `planSpec`.
  - `doneRegions` refuses a region index past 2³² − 1 (400). Such an index was read as its bottom
    32 bits, so it skipped another region without a word.

  **Parts** (`GET /v1/parts/{id}`):

  - `preparationId` (experimental): the region space the part result's `regions` are in, which a
    `planSpec` names. Null on part results made before this release; analyze the part again to get
    one.

  **Plans** (`GET /v1/plans/{planId}`):

  - `planSpec` (experimental, `PlanSpec`): the plan's statement of itself by region index, every
    field written out and every feature's type stated, whether it was stated by `planSpec`, by
    `setupPlan` and `doneRegions`, or not at all. Sent back with the same tool crib, material,
    machine, stock and workholding, it plans the same. Its `skippedRegions` are the job's own,
    without those a stock body leaves material-free. Null on plans made before this release, and on
    a plan whose completed spec is more than a request takes.

  **Features** (`GET /v1/parts/{id}/features`, no change of shape):

  - A top face read for facing has its own outline in `contours` since tp-kernel 0.32.0, and the
    description of `contours` no longer lists it among the features with none. A part analyzed before
    that keeps an empty list until it is analyzed again.

## 0.14.0

### Minor Changes

- db9a8f6: Regenerate the TypeScript SDK for Engine API 1.40.0.

  ### Engine API 1.40.0

  tp-kernel 0.32.0. A feature's clearance states the bounds every terminal tool is held to, and plans
  cut holes and narrow features more closely.

  **Features** (`GET /v1/parts/{id}/features`):

  - `CdData.limit`: the clearance-diameter bounds while deviations up to the tolerance band's
    largest are allowed, which every terminal tool is held to. `ignore`, `deviate` and `limit` are
    ordered: each admits at least what the one before it does. Absent on datasheets enriched before
    this release. `effectiveAdaptive` is unchanged, and no tool is sized by it.

  **Parts** (`GET /v1/parts/{id}`, no change of shape):

  - `DirectionZBounds` says which frame its `zMin` and `zMax` are in: the `toolFrame` that
    `GET /v1/parts/{id}/features` serves with `include=contours` for each feature of that direction,
    the frame the feature's datasheet heights are in. A part's z extent and a feature's `zMin` and
    `zMax` along one direction compare directly.

  **Plans** (no change of shape):

  - A terminal tool may miss the model by up to the tolerance band's largest deviation at the
    narrowest place it has to reach, a rounded corner, a width or a sharp corner alike: a filleted
    pocket may get a wider finisher, and a wall or a profile a narrower one.
  - A hole cycle feeds from each hole's start rather than from its hop above it. A blind hole whose
    cone a hole below cuts off is drilled to where its tip would be.
  - A chamfer band narrower than about 0.3 mm is finished with passes on its two edges, where its
    finish could fail. A pocket no longer gets a rest rough for rest under a hundredth of an inch.

  **Toolpaths** (experimental, `camExportUrl` on `GET /v1/plans/{planId}/toolpaths`): the CAM
  export's `job.json` leaves out a field with nothing to state rather than writing it as null; a
  setup states its `process` (`Milling`) where it stated its `machine` (`Mill`), a tool's thread is
  a `thread` of its own, and a milling action's faces are the action's `sheets`.

## 0.13.0

### Minor Changes

- 636e37c: Regenerate the TypeScript SDK for Engine API 1.39.0.

  ### Engine API 1.39.0

  tp-kernel 0.31.1. A part says where it and its features are: the part's box, a hole's, a circular
  wall's and a countersink's top center, and a feature's plan-view contours on request. A part also
  keeps the name it was uploaded as.

  **Parts** (`GET /v1/parts/{id}`):

  - `boundingBox`: the box the part fits in, axis-aligned in mm in the part's coordinates. Null on
    part results made before this release; analyze the part again to get one.
  - `filename`: the name the part was uploaded as, the `filename` given to **Create a part** or its
    file's name for a part made from a file. Absent where none was given, and on earlier parts.
    **Create a part** now refuses a `filename` with control characters, as **Create a file** does.

  **Features** (`GET /v1/parts/{id}/features`):

  - `HoleFacts.topCenter`, `CircularWallFacts.topCenter`, and `SinkFacts.topCenter`: where the
    feature's axis meets its top, in part coordinates, so a counterbore or a countersink can be
    stacked on the hole below it. Absent on datasheets enriched before this release.
  - `include=contours` adds each feature's `contours` and `wallContours`, with the `toolFrame` they
    are in: its plan-view outline as exact segments and arcs (`ContourCurve`), an open pocket's
    walls, and the frame of its direction in part coordinates. Empty where a feature has none, and
    where the kernel could not project it. Null on features measured before this release; analyze
    their features again to get them. Without `include`, the response is unchanged.

  **Plans** (no change of shape):

  - An outer fillet that rounds an edge and leaves its finish no more than two axial allowances is
    finished once the faces it blends are, with no rough of its own, whatever arc it turns through.
    A shallow pocket whose entrance nothing in its setup finishes, formerly left unmachined, is
    roughed.
  - A slot rough is cut as slot machining, held to its slots by their outlines.
  - Fixes to finishing tool matching and to clearance measurements. Toolpaths and estimated times
    move.

  **CAM export** (`camExportUrl`, experimental):

  - `job.json` also states how each pass links its cuts and how closely its toolpath is fitted to
    arcs, and the toolpaths follow it.

  **Operations**:

  - Run the migration, then deploy workers, then the API. The migration only adds columns.

  ### Engine API 1.38.1

  tp-kernel 0.31.0. A turned hole's thread is measured from its tap drill, and a plan leaves whole a
  feature no tool can rough. No field or shape changes: the descriptions of
  `TurnedAxialHoleFacts.thread` and `TurnedThreadFacts.depth` change to say how.

  **Turned features** (`turning` on `GET /v1/parts/{id}`):

  - A turned hole's thread is cut from its tap drill, however the hole is drawn. A hole drawn at its
    thread's nominal diameter now carries the thread, where it was turned plain.
  - An internal thread's `depth` runs from the tap drill to the thread's root, where it ran from the
    wall as drawn, and its `rMin` is the nearer of its wall and the tap drill.
  - A turned axial hole's `thread` is the one it is drilled for, at its tap drill. It is absent where
    that thread is beside a stretch of the hole narrower than its tap drill.
  - A part analyzed before this release keeps its readings until it is analyzed again.

  **Threads** (`threading` in feature datasheets, `threadSpec` on turned threads):

  - A modeled thread is read as a catalog thread only where that thread's form can be cut in the
    wall it leaves. A modeled thread can therefore be read as another catalog thread than before, or
    as its spec as modeled where no catalog thread fits.

  **Plans** (no change of shape):

  - A feature no tool of the plan can rough, such as a pocket with a finger too narrow for every
    rougher once both its walls keep their stock, is no longer finished out of solid. No pass cuts
    it, and its setup lists it in `unmachined`. A wall beside it, or beside a feature no setup
    machines, is left the same way, since that feature's material stands against it. With
    `fallbackTools`, a fallback rougher can be made for it.
  - Milling passes cut climb wherever they can, a face is swept along the direction it is narrowest
    across, and a helical bore leads out on a wider arc. Toolpaths and estimated times move.
  - A stud whose thread is cut into the part's outline now gets its thread milling pass, or, where no
    tool cuts the thread, is listed in its setup's `unmachined`. A plan used to leave the thread out
    without listing it.
  - A wall whose open run turns a concave corner tighter than its mill is roughed and finished, where
    it and the walls beside it were left out.

  **CAM export** (`camExportUrl`, experimental):

  - Each pass's geometry is the part's, no longer offset by the stock to leave, so a receiver leaves
    the stock itself. `job.json` also states each pass's collision clearances and what it does on a
    collision, its leads, which way it cuts, a rough's ramp, a face's pass angle and extensions, and
    an open wall's runs.

  **Operations**:

  - Deploy workers, then the API.

## 0.12.0

### Minor Changes

- ddf6a2b: Regenerate the TypeScript SDK for Engine API 1.38.0.

  ### Engine API 1.38.0

  The toolpath file names its links as the kernel does.

  **Toolpaths** (`GET /v1/plans/{planId}/toolpaths`):

  - The file at `toolpathUrl` gains `sections`, the path in order: each the points from `start` up
    to `end` (exclusive), each after the first starting with a copy of the point before it, and its
    `kind`, one of `Cutting`, `Approach`, `LeadIn`, `ConnectionNotClearanceArea`,
    `ConnectionClearanceArea`, `LeadOut` or `Retract`. Kinds may be added in any release; read an
    unknown one as a link. A file written before this release has none.
  - `segments` is deprecated: the same ranges, with every link (approach, connection, retract) a
    `RapidMove`. It is removed in 2.0.0.

  **Operations**:

  - Deploy workers, then the API.

  This release is additive to the contract.

  ### Engine API 1.37.0

  A calculated plan can now be taken into another CAM system: the toolpaths read carries a CAM export
  of the job. It is experimental.

  **Toolpaths** (`GET /v1/plans/{planId}/toolpaths`):

  - `camExportUrl` (new, experimental) is a short-lived URL for a zip another CAM system rebuilds the
    job from in its own operations: `job.json` with the tools, the features, the setups, and each
    action as its intent, tool, heights, feeds and strategy, a refused action with its reason; the
    part and the faces each action machines as STEP; and each calculated action's
    toolpath. Its format may change in any release. It is null for a plan calculated before this
    release, and where the export is unavailable.

  **Operations**:

  - Deploy migrations, then workers, then the API.

  This release is additive to the contract.

  ### Engine API 1.36.0

  tp-kernel 0.30.0. A stud's modeled thread is now read and machined as a hole's is, and feature
  datasheets gain new readings. Every change to the contract is additive.

  **Feature datasheets** (`GET /v1/parts/{id}/features`, and turned features on `GET /v1/parts/{id}`):

  - A circular wall carries `threading` where its stud is to receive a thread: an external thread,
    milled. A `ThreadSpec` gains `side`, `Internal` or `External` (absent: internal), and
    `maxMajorDiameter` (absent: its `minMajorDiameter`). A thread read before this release is always
    a hole's.
  - A surface carries `minCurvatureDiameter`, the widest ball whose tip follows every bend of it, and
    `minCurvatureDiameterAt`, where that is read, in part coordinates. Both are absent on features
    read before this release.
  - A turned axial hole carries `isThrough`, the same flag as `through`. It is absent on turned
    features read before this release, so `through` remains the field to read.
  - A turned external thread cut out on import (below) now has a `threadSpec`, as does a cut-out
    thread no catalog thread fits, which is threaded to its spec as modeled. A thread the outline
    shows as a run of teeth still has none.
  - The facts unions are named components, `FeatureFacts` and `TurnedFeatureFacts`. Their shapes are
    unchanged. The TypeScript SDK names its types after the components, so `FeatureDatasheetFacts`
    becomes `FeatureFacts` and `TurningDatasheetFacts` becomes `TurnedFeatureFacts`, with their
    `FromJSON` and `ToJSON` helpers; `FeatureDatasheet['facts']` and `TurningDatasheet['facts']` name
    the same types in both.

  **Parts and plans** (no change of shape):

  - A part is faceted differently, so its mesh, its regions' areas and what is measured off them move
    slightly. Region indices and feature tags may change when a part is analyzed again: as always,
    state `doneRegions` and tags from a report read under the same `kernelVersion`.
  - A modeled external thread is cut out when a part is analyzed, where it comes out cleanly, leaving
    the stud at its major diameter: the mesh shows a plain stud, its circular wall carries the thread,
    and a plan owes it a thread milling pass, from the tool crib's `tap` family. One that does not come
    out cleanly stays modeled, as before. With that family off, every stud is
    planned without its thread. A part report stored before this release carries no stud threading
    until the part is analyzed again.
  - Where a thread covers only part of a cylinder, each stretch is a feature of its own: a hole tapped
    at its mouth and drilled deeper is a threaded hole over a plain one.
  - A thread is cut from the end of its cylinder that nothing stands in front of. A stretch under more
    of its own cylinder is planned from its other end, or not at all.
  - A plan may now cover regions it used to leave out, in a further setup where they need one.
  - A narrow 3D surface — a chamfer-like strip, or a band narrower than the ball's radius — is
    finished in a pass of its own.
  - A plan's estimated times can move slightly. Most are unchanged; where they move, they rise.
  - `turnability` rises on a part whose modeled external thread is cut out, its stud now reading as
    a plain cylinder at the thread's major diameter.
  - `PlanIssueFeature.rejections` and a tool's `outsideCrib.reasons` now give, for a `Thread` pass,
    why no threading tool could be made: `ThreadNotOnGrid`, `ThreadTapered`,
    `ThreadEntryObstructed`, `ThreadLeadTooLong` or `TeethLengthTooLong`.
  - Analyzing and planning a large part takes less time.

  ### Engine API 1.35.0

  A part can now be cut from another body of its own file — a casting, a forging, what an earlier
  operation left — and a file's bodies are grouped into shapes and served as a mesh. Everything on
  files and body stock is experimental.

  **Breaking, experimental** (`Files`, new in 1.32.0):

  - `FileBody.role` is removed, and so is the `stock` role. A file carries no roles: a body that is
    not made a part is simply not one, and the body a part is cut from is stated as that part's
    stock (below).
  - `POST /v1/files/{id}/parts` takes `bodies` as the indices of the bodies to make parts of — each
    named once, at most 100 to a call — where it took `{ index, role }` entries. An entry in the old
    shape is `400 invalid_request`.

  **Files**:

  - **Shapes.** When a file is inspected, separate copies of one shape, in any position and
    orientation, are grouped into one shape. Bodies are matched on their volume, surface area, face
    count, mass distribution and handedness, not their exact geometry, so some different bodies
    cannot be told apart: two plates with the same hole pattern rotated differently on a symmetric
    plate, or a part and its mirror image where the part is close to symmetric. Check the grouping
    before quoting from it. Each `FileBody` has a `shape`: the `index` of the first body it is a copy
    of, its own when it is the first. `GET /v1/files/{id}` also returns `shapes`, one `FileShape` per
    distinct shape: its first body as `index`, every body that is it as `bodies`, and the `count` a
    quote multiplies by. Today each body counts one; a body an assembly places more than once is
    listed, and counted, once.
  - `POST /v1/files/{id}/parts` answers each part with the `shape` its body is — the same `FileShape`
    `GET /v1/files/{id}` lists — so a client can make one part of a shape and quote it by the shape's
    `count`. Any body can be made a part, a copy of another included.
  - `GET /v1/files/{id}/mesh` (new) returns a short-lived URL for a binary glTF (GLB) of every body,
    one node per body: node `body-<index>` is the body at `bodies[index]`, named by index only.
    Meshing is best-effort, so a file can be listed without one: it is `409 file_not_inspected` before
    an inspection has succeeded and `404 mesh_not_found` when the inspection stored no mesh.
    `GET /v1/files/{id}` says which with `hasMesh`. Reading the mesh is unmetered, like the rest of a
    file.

  **Stock from a body** (`POST /v1/parts/{id}/plans`, `POST /v1/parts/{id}/toolpaths`,
  `POST /v1/plans/{planId}/toolpaths`):

  - `stock` takes a fifth, experimental mode, `BodyStock`: `{ mode: "body", bodyIndex }`, another body
    of the part's own file. It is taken where it lies, never sized or squared up. It is
    `400 stock_body_requires_file` for a part not made from a file, `400 unknown_body` for an index
    the file has no body at, and `400 own_body` for the part's own body; none of these is metered. A
    recalculation that names no stock keeps it, like any saved stock.
  - Regions of the part the stock body already leaves at their final surface are skipped, as done
    regions are: no setup machines them and no pass or issue is spent on them.
  - `stock.resolved` on the plan reads takes a third, experimental shape, `StockBody`:
    `{ shape: "body", bodyIndex, materialFreeRegions }` — which body the plan was cut from, and the
    region indices it skipped as material-free. No figure is reported: the body is the figure.
  - `trimmedFeatures` on a plan also describes what a region the stock body leaves material-free left
    of a part feature, as it does for done regions and stated features, and a `setupPlan` sent back
    may name such a feature. A plan cut from a stock body that leaves any region material-free has
    `trimmedFeatures`, empty where nothing was trimmed; it is null only for a plan that skips no
    region and whose `setupPlan` names no feature.
  - A part that stands outside its stock body fails the job before anything is planned, its `error`
    beginning `part_outside_initial_stock:` and naming the stock body by its index, in thin air and
    held in a vise alike. A stock body that misses the part entirely fails the same way, rather than
    leaving nothing to machine. A stock body the file no longer holds as it was when the part was
    made fails it as `body_mismatch:` (or `body_not_found:`), naming it as the stock body: plan again
    with a stock body from the file as it now reads.

  **Job failures**: three new errors, each failing the job at once, begin:

  - `own_body:` — the stock body and the part resolve to the same body of the file. The API refuses
    the part's own index as its stock, but each is resolved again by its fingerprint when the job runs.
  - `stock_body_missing:` — the job names a body of the part's file as its stock but carries no stock
    body. The API never sends such a job; it is a malformed message.
  - `stock_body_unusable:` — the stock body could not be faceted into the mesh it is cut from. It is
    named by its index in the file; plan again with another stock.

  **Operations**:

  - Deploy migrations, then workers, then the API. A worker from before this release does not know
    body stock: given a plan from a stock body, it fails the job only after its retries — the plan
    already metered — where a current worker plans it.
  - Rolling the API back once a plan has been cut from a stock body makes reading that plan fail with
    `500`: an earlier API does not know its `stock.resolved` shape.

  Apart from the experimental breaks above, this release is additive to the contract.

  ### Engine API 1.34.1

  Plans are made by the kernel's planner in one step, behind the same requests and responses. No field
  or shape changes. A plan made with the same settings chooses the same setups; its tools, passes and
  estimated times can move. The descriptions of `setupPlan`, `trimmedFeatures`, `TrimmedFeature`,
  `PlanIssueFeature.cause` and `PlanIssue.unattributedRegionCount` change to say how.

  **Stated plans** (`setupPlan` on **Create a plan** and **Calculate a plan's toolpaths**):

  - A feature a `setupPlan` names is machined where it is named whatever it needs. One no tool in the
    crib cuts is planned all the same, its passes left `unmachined`, where the job failed as
    `refused_user_plan:` because the feature was not offered.
  - A feature a `setupPlan` names keeps its regions from every other feature, in every direction. A
    feature that shares one is planned as what is left of it, under a tag of its own, which the plan's
    `setupPlan`, `featureTags`, `unmachined` and issues may name. The plan's `trimmedFeatures` lists
    it with the part feature it was cut from, and a `setupPlan` sent back may name it, so a plan read,
    edited and sent back plans the same, that tag included.
  - A plan whose `setupPlan` names a feature has `trimmedFeatures`, empty where nothing was trimmed,
    where it was null without done regions.
  - A refused statement's `refused_user_plan:` clause may be worded differently. The form is
    unchanged: a count, then one clause per refused statement, separated by `;`, each naming the
    setup and the feature by the tag that was sent.

  **Plans** (experimental) and estimates move:

  - A plan's tools are made for the features it machines, rather than for every feature measured, so
    fewer are made. A pass can be given a smaller, shorter or slower tool than before, and the passes
    with it, their order and their estimated times move. Most plans' times are unchanged; where they
    move, they more often rise than fall.
  - A plan measures only the features it needs: one that a pocket of another direction would take
    over, or one another reading from a direction the plan needs covers whole, is not measured.
    Planning takes less time, most of all in thin air. With done regions, the setups can come in
    another order, and a region can be machined from another direction.
  - An issue may no longer name a feature the plan did not measure: a region only it holds counts in
    `unattributedRegionCount`, where the issue named the feature with `cause` `Revoked`.
  - With `fallbackTools`, a fallback tool is made for each pass the crib leaves owed, rather than for
    the whole of each such feature. A feature only a fallback tool cuts is planned only where it
    machines a region no other feature can with the crib alone, judged for each direction the plan
    may start in. An issue can name such a feature with the new `cause` `FallbackNotNeeded`.

  ### Engine API 1.34.0

  The outside of a whole cylinder — a stud, a round boss, a turned part's outline — is a feature type
  of its own, `CircularWall`. Toolpath files hold fewer segments, a file the kernel cannot read fails
  at once, and analysis selects more directions. Plans and estimates move. Parts and plans made from
  this release report `kernelVersion` 0.29.0, so feature tags and region indices read under an earlier
  one no longer apply.

  This release makes two breaking changes to stable surface without a major: a feature that read as a
  `boss` or a `wall` can now read as a `circular_wall`, and a turning reading that failed reports a
  `code` of `unsupported` or `internal` where it reported `geometry`.

  **Part features** (`GET /v1/parts/{id}`, `GET /v1/parts/{id}/features`):

  - `CircularWall` is a new `FeatureType` value, and `circular_wall` a new feature `featureType`: the
    outside of a whole cylinder standing along the direction the feature is machined from. Its
    datasheet's `facts` are the new `CircularWallFacts`: `kind`, `cd`, `diameter`, `standsOnAFloor`,
    and `wallLength`, absent where no outline could be read. It is machined as a boss where it stands
    on a floor, and as a wall where it does not.
  - **A breaking change without a major.** Such a feature read as a `boss` where it stands on a
    floor and a `wall` where it does not, with that kind's facts. A round boss with a blend at its
    foot read as a `filleted_boss`; it now reads as a `circular_wall`, its blend a feature of its own
    beside it. Features enriched before this release keep the type they stored. It is made in a minor
    because `featureType` has always been documented as open-ended, so a client already meets types it
    does not know, and the clients we know of keep working with it. A client that read `boss` as
    "stands on a floor" should read `standsOnAFloor`, and one that matches types by substring will
    find `wall` in `circular_wall`, a stud standing on a floor included.
  - An island is part of the pocket of the floor it stands on, unless its foot disagrees with that
    floor's blends — sharp beside filleted, or two radii. A face with islands and no walls of its own
    becomes an `open_pocket` or `filleted_open_pocket` round them.
  - **Analysis selects more directions.** A plane that is at least a twelfth of the part's area is
    faced from its own normal, and so is the floor of an inside corner that a blend rounds.
    - Every part keeps the directions it had, and some gain one: a cube now reads six directions, not
      four.
    - A part that gains a direction may split its regions differently, so its regions and feature
      tags move with it. Done regions read under an earlier release already fail as
      `stale_regions:`.
    - Every direction is measured, so planning takes a little longer on a part that gains one.
    - A part still takes up to 12 added directions: the limit counts only directions added with
      **Analyze a part**.
  - A direction added with **Analyze a part** within 0.1° of the exact opposite of a direction the part
    has is added as that exact opposite, where it was added as sent. Read it back off
    `candidateDirections` rather than matching the direction sent. The descriptions of the request's
    `directions` and the part's `addedDirections` say so.
  - **More features report pinch points.** A surface whose widest reaching tool is a bullnose or a
    flat, not only a ball, reports `pinchPoints` on that tool's axis, level with its corner's center.
    A hole reports one, on its axis at the top of its wall, and a dovetail one per run of its
    overhangs' foot. `PinchPoint.center` is still read off `point`, as before. The descriptions of
    `PinchPoint.point` and `FeatureDatasheet.pinchPoints` change to say so.
  - A profile's clearance is measured round the outline its pass follows, rather than through the
    part at the pass's height. What the outline hides from a tool coming down past it, such as a
    notch in a lower stage or a side hole, no longer narrows it; what stands above that height does.
    A profile that runs along no wall, such as a cone's, is now measured where its measurement
    failed.

  **Plans** (experimental) and estimates move:

  - A feature is planned once a tool meets its first owed pass: a hole an undersized drill pre-drills
    and a tap threads, with no tool to finish it, is planned and pre-drilled, where it was refused.
  - A pass leaves the stock it is given on the floors under it and the walls beside it, and a rough
    drill stops short of a blind hole's floor by the feature's `axialStockToLeave`.
  - Whole-part roughing, facing passes, spot drilling, bevel finishing and time estimates are fixed.

  **Toolpaths** (experimental; `toolpathUrl` and `refusedReason` on **Get a plan**):

  - A toolpath file holds fewer `segments`: a path no longer splits, nor repeats a point, where only
    the feed or the rapid flag changes. Its shape and its four kinds — `Cutting`, `LeadIn`, `LeadOut`
    and `RapidMove` — are unchanged, and each segment after the first still starts on a copy of the
    last point before it, so a reader walking each segment's moves misses none.
  - A refused action's `refusedReason` begins `refused_pass:`, `timed_out:`, `invalid_argument:` or,
    for a fault in the calculation, `internal:`, where it began `geometry:`, and still `unsupported:`
    for a pass nothing can cut yet. Actions calculated before this release keep the reason they
    stored.

  **Turning** (`turning` on `GET /v1/parts/{id}`):

  - **A breaking change without a major.** A `TurningSpinFailed` reading's `code` is `unsupported` or
    `internal` where it was `geometry`: the value an existing kind of failure reports changes. Reports
    made before this release keep the code they stored. It is made in a minor because no client we
    know of branches on this code. A client that does should treat `internal`, and any code it does
    not know, as it treated `geometry`.

  **Job failures**:

  - A job on a part, or an inspection, whose file the kernel cannot read now fails at once, its
    `error` beginning `unreadable_file:`, where it was retried and then failed with a geometry error.
  - A fault of the kernel's own is still retried, and the `error` the job fails with names `internal:`
    where it named `geometry:`. A holder file the kernel cannot read is still retried too, and names
    `parse:`.
  - As before, read the code an `error` begins with, and treat its wording as free to change.

  ### Engine API 1.33.3

  The API reference and guides now describe the job event stream as the way to wait for background work. Operations answering 202 point to Stream job updates, listed before Get a job. Examples use the SDK wait helpers or bounded readers for curl, browser fetch, and Python. Operation paths include their `/v1` prefix.

  The waiting guide distinguishes permanent execution deadlines (default 300 seconds), DLQ recovery after exhausted deliveries, and the 24-hour queued limit. Recovery latency depends on healthy consumers and infrastructure.

  ### Engine API 1.33.2

  Jobs whose queue deliveries are exhausted now reach a final status through a DLQ consumer in the worker parent process. Jobs still queued after 24 hours fail with `job_dispatch_failed`. Recovery waits for healthy workers and database access; it does not infer failed attempts from elapsed leases.

  The job stream no longer closes after five minutes. Its database listener uses TCP keepalive to detect lost connections and reconnect. With operating-system keepalive defaults, a silently dropped database connection can take on the order of ten minutes to detect; until then, open streams receive keepalive comments but no updates.

  Job execution retains its 300-second default hard deadline, which is service configuration rather than something clients set. A deadline kill fails permanently without another attempt.

  ### Engine API 1.33.1

  Operations that queue work now return 503 `job_dispatch_failed` when a transient queue send fails, and discard the still-queued job so the same Idempotency-Key can be retried safely. Deterministic dispatch refusals return 500. An admitted job that cannot be sent is reported failed to Portal. When the Idempotency-Key is a UUID, planning retries use a deterministic plan ID so an ambiguously accepted send cannot leave the returned plan missing; other keys get a new plan ID on each retry.

  ### Engine API 1.33.0

  A failed job is now final, and a job says how many retries it has left.

  - **`failed` never changes.** A job is `queued` until a worker starts it, then `running` until it
    finishes, including while it waits to be retried after a failed attempt. `succeeded` and `failed`
    are final: a job in either state never changes again. Before, an attempt that would be retried
    showed `failed`, with its `error`, until the retry moved the job back to `running`.
  - **`retriesRemaining`** is new on **Get a job** (`GET /v1/jobs/{id}`) and on each `job` event of
    **Stream job updates** (`GET /v1/jobs/{id}/events`): how many more times the job will be attempted
    if its current attempt fails. It counts down to 0 on the last attempt and is `null` before the
    first. A failed job keeps the count it stopped at, which is above 0 when no retry could have
    fixed the failure.
  - **Stream job updates** closes after sending `succeeded` or `failed`, including for a job that is
    already final when the stream opens. It used to close on `succeeded` only, and held a failed job's
    stream open for up to five minutes. A stream that closes before a final status should still be
    reopened.
  - `error` is set on a `failed` job only. A job that succeeds on a retry no longer carries the error
    of the attempt that failed.

  This is a breaking change made in a minor release, without a major version. It is made because a
  client could not tell a failed attempt that would be retried from a job's last failure, so the only
  safe reading of `failed` was to wait. The status values and the SDK's status enum are unchanged, but
  `failed` no longer moves: a client that waited on a failed job in case a retry moved it back to
  `running` can show the failure as soon as it arrives. Such a client must not open the stream again
  as soon as it closes: a failed job's stream sends `failed` and closes at once, so reopening it in a
  loop spends the key's rate limit. `retriesRemaining` is additive.

  While this release rolls out, a job running across it may still behave the old way once. A job
  whose attempt failed just before the rollout shows `failed` and is not retried, though it had
  retries left. A job that just reached `succeeded` or `failed` can be moved back to `running` and
  run again, then reaches a final status as before.

  ### Engine API 1.32.0

  A CAD file can now hold more than one solid body — a part beside its stock, or several parts. Upload
  it as a **file**, inspect it to list its bodies, and make parts of the ones to machine. Every new
  operation and field is experimental.

  **Files** (new, experimental; the `Files` tag):

  - `POST /v1/files?filename=` creates a file and returns a short-lived upload URL, as **Upload a
    part** does. The filename is required, and must end in an extension a reader is chosen for —
    `.step`/`.stp`, `.x_t`/`.x_b`, `.sldprt`, `.catpart`, `.prt`, `.igs`/`.iges`, `.ipt`, `.par`,
    `.sat`/`.sab`, or `.3dm` — or it is `400 invalid_request`.
  - `PATCH /v1/files/{id}` queues an inspection and returns a job; it is `409 file_not_uploaded` until
    the file is uploaded, and honours `Idempotency-Key`. A file is inspected once: once its bodies are
    listed they never change, and a further inspection is `409 file_already_inspected`, though a retry
    with the original `Idempotency-Key` still answers with its job. A failed inspection lists nothing,
    and can be run again. One inspection of a file runs at a time: another, while one is queued or
    running, is `409 file_inspection_in_progress`.
  - `GET /v1/files/{id}` returns the file and its `bodies`, each a `FileBody`: its `index`, its `name`
    where the file gives one, its `faceCount`, a `boundingBox` it fits in, and the `role` it was last
    given. `bodies` is empty until an inspection has succeeded, and an `index` names the same body for
    the life of the file.
  - `POST /v1/files/{id}/parts` takes `bodies`, each an `index` and a `role` of `part`, `stock` or
    `ignore` — at most 100 to a call — records the roles, and makes a part of each `part` body. A body
    that is already a part returns that part, with `created: false`, so one body of a file is only
    ever one part and is never billed as two. It is `409 file_not_inspected` before an inspection has succeeded and
    `400 unknown_body` for an index the file has no body at. The `stock` role is recorded and not yet
    used by planning.
  - A file is `410 file_expired` past the retention window, like a part, on every file operation but
    its creation.
  - Creating, inspecting and reading files, and making parts of them, are unmetered. A part made from
    a file is an ordinary part from then on, metered as any other.

  **Parts**:

  - `POST /v1/parts` takes a new, optional and experimental `bodyIndex` query parameter, an integer
    from 0: which solid body of the uploaded file the part is. A multi-body file uploaded without one
    fails analysis as `multiple_bodies:`, listing its bodies on the job (below); upload it again with
    `bodyIndex` set to the `index` of the body to machine, and the part is that body from then on —
    analyzed, measured, meshed, planned and cut exactly as a single-body file is. `0` on a file of one
    body names that body, and makes the same part as an upload without `bodyIndex`; an index past the
    file's last body fails as `body_not_found:`. A body is chosen by index, not by name: names can
    repeat, and some formats have the kernel name a body the file leaves unnamed. The first job to
    load the file records how many bodies it holds and the chosen body's name and box, and every job
    after it checks them, as for a part made from a file: should a later kernel read the file's bodies
    differently, the part fails as `body_mismatch:` rather than becoming another body.
  - `GET /v1/parts/{id}`: `fileId` and `bodyIndex` are new, optional and experimental: the file a
    part was made from and which of its bodies it is, or the `bodyIndex` it was uploaded with. Both
    are absent on a part uploaded with neither. Once the file is deleted or pruned past the retention
    window, `fileId` is absent and `bodyIndex` stays.

  **Jobs** (`GET /v1/jobs`, `GET /v1/jobs/{id}`):

  - `fileUuid` is new and experimental, beside `partUuid` and `holderUuid`: the file an inspection job
    ran on, or null on every other job. An inspection job's `partUuid` and `holderUuid` are both null,
    and its `productType` is `inspect-file`. `GET /v1/jobs` lists those inspection jobs too, once an
    organization uses files, so a client reading `partUuid` or `holderUuid` off every listed job must
    allow both to be null.
  - `bodies` is new, optional and experimental on `JobDetail` (and so on each `job` event of
    `GET /v1/jobs/{id}/events`): the solid bodies of the part's file, each its `index`, `name`
    where the file gives one, `faceCount` and `boundingBox` — the fields of a `FileBody`. It is
    listed only on a job that failed `multiple_bodies:` or `body_not_found:`, for choosing the
    `bodyIndex` to upload again with, and absent on every other job. Body names appear only here,
    never in `error`.

  **Job failures**: a job on a part, or an inspection, now fails at once, rather than being retried,
  when the file cannot give it what it needs. Its `error` begins:

  - `multiple_bodies:` — the part was uploaded with no `bodyIndex` and its file holds more than one
    solid body. The job lists them in `bodies`: upload the file again with `bodyIndex` set to the
    `index` of the body to machine, or upload it as a file and make a part of that body.
  - `no_solid_bodies:` — the file holds no solid body. An inspection fails the same way.
  - `body_mismatch:` — the file's bodies changed since the part's body was recorded, when the part
    was made from a file or, for a part uploaded with `bodyIndex`, when its first job loaded the file:
    it holds another number of bodies, or the body at the part's index no longer carries its name and
    box, and no one other body of the file does. Make the part again: from the file uploaded again as a
    file, or by uploading the part again with `bodyIndex`.
  - `body_not_found:` — the file has no body at the part's index. The job lists the bodies it does
    have in `bodies`.
  - `unsupported:` — the kernel will not take the file: a format it does not read, or a file it reads
    but cannot analyze, such as one with a modeled internal thread that will not come out. The
    kernel's own first line, as it gives it.

  A geometry error is none of these: it can depend on the machine as much as the file, so the job is
  retried. For now, a file the kernel cannot read at all is reported as such a geometry error: it is
  retried, then fails as before.

  **Behaviour change on existing part jobs**: the changes above also reach parts uploaded with
  `POST /v1/parts` as before, with no `bodyIndex`:

  - A multi-body file now fails at once as `multiple_bodies:`, listing its bodies in `bodies`. It
    used to be retried until the queue gave up, then failed with the kernel's own text, which named
    the file's bodies.
  - A file with no solid body now fails at once as `no_solid_bodies:`.
  - A file the kernel will not take now fails at once as `unsupported:`, where it was retried first.
    A file the kernel cannot read is unchanged: it is still retried, then fails with a geometry error.
  - These failures' `error` no longer begins `Error: `, and keeps only the first line of the kernel's
    reason.
  - The job's final `status` is still `failed`. Matching on the text of `error` is not supported:
    read the code it begins with, and treat its wording as free to change.

  ### Engine API 1.31.1

  `PartFeature.axis` is deprecated. Since Engine API 1.0.3 it has held the direction the feature was
  extracted from, the same value as `machiningDirection`, so read that instead.

  **Get a part** (`GET /v1/parts/{id}`):

  - Each feature's `axis` is marked `deprecated` and will be removed in the next API major. Until then
    it is still present on every feature and still equals `machiningDirection`.

  This release is additive to the contract: no field or shape changes, only the deprecation and its
  description.

  ### Engine API 1.31.0

  Parts and plans made from this release report `kernelVersion` 0.28.0, so feature tags and region
  indices read under an earlier one no longer apply. An `OutOfPlay` plan issue now names the features
  holding its regions, and says why none was in play.

  **Plans** and estimates move:

  - Whole-part roughing (`Rough`, `AdaptiveRough`) roughs contour surfaces, fillets and chamfers in
    three dimensions, and filleted pockets, open pockets and bosses unless the tool's corner matches
    the fillet.
  - Turned feature extraction, roughing and undercutting passes, hole cycles, wall finishes and time
    estimates are fixed.
  - `intent`: new plans no longer report `Rough3d`; they report `AdaptiveRough` in its place. The
    value stays in the enum for plans made before this release.

  **Fixed stock the part stands outside** (`stock` on `POST /v1/parts/{id}/plans`,
  `POST /v1/parts/{id}/toolpaths` and `POST /v1/plans/{planId}/toolpaths`):

  - The job fails with `error` beginning `part_outside_initial_stock:`, naming the direction the
    stock is squared up in, where it began `invalid_argument:` and said how far the part stands
    outside. In thin air, that is the plan's first direction.
  - Held in a `syntheticVise`, the stock is gripped only in the directions the part fits it squared
    up in, and the plan starts in one of those. Where the part fits it in none, the job fails with
    `error` beginning `part_outside_initial_stock:`, naming every direction. So does a `setupPlan`
    whose first setup is stated in a direction the part does not fit it in, which failed as
    `invalid_argument:` before.

  **Plan issues** (experimental; `issues` on **Get a plan**, `GET /v1/plans/{planId}`):

  - `PlanIssue.features` is new and optional, an array of `PlanIssueFeature`. An `OutOfPlay` issue
    lists each feature whose regions meet the issue's, by `featureTag`, with `cause`, `owed` and
    `rejections`. The cause says why it was never in play: refused by the tools (`ToolsRefused`),
    excluded by the planner (`Revoked`, `RefusesEveryTool`, `MeasurementFailed`), or one the plan's
    reading of it would not measure (`Unmeasured`). An `Unseen` issue lists none, and an `Incomplete`
    issue carries no `features`.
  - `owed` lists the passes no tool of the plan meets (`Rough`, `Finish`, `Thread`). `rejections`
    lists, for `ToolsRefused`, why no tool was invented for those passes, each reason once: the tool
    crib's reasons, or with `fallbackTools`, the reasons no fallback tool could be made, reach lifted.
    It is always empty for a `Thread` pass, and empty when the crib lists no tool head and
    `fallbackTools` is off.
  - `cause` and `rejections` are strings, not enums: values may be added in any release.
  - `PlanIssue.unattributedRegionCount` is new and optional, present wherever `features` is: how many
    of the issue's regions no feature in `features` holds. A sliver held only by an edge break's dead
    stop counts here.
  - Both are absent on every issue of a plan whose features could not be read, which states its
    issues without them, and on plans made before this release.

  **List plans** (experimental; `GET /v1/parts/{id}/plans`):

  - Each summary's `issues` are now the new `PlanIssueSummary` component, `kind`, `area` and
    `regionCount` as before, and carry neither field: a plan's features are read from the plan.

  This release is additive to the contract.

  ### Engine API 1.30.0

  Turning is stable: a part's `turning` reading, its turned features, and their datasheets, but for
  four of their fields. Parts and holders can be uploaded in four more CAD formats, and a done region
  is now left out of every feature a plan machines. Plans move. Parts and plans made from this release
  report `kernelVersion` 0.27.0, so feature tags and region indices read under an earlier one no
  longer apply.

  **Turning** (`turning` on `GET /v1/parts/{id}`) is no longer experimental:

  - `turning`, the `Turning` union and every component inside it — `TurningTurned`, `TurningNoAxis`,
    `TurningBelowThreshold`, `TurningSpinFailed`, `TurningNotRequested`, `TurningFrame`,
    `AxisSource`, `OutlinePoint`, `TurnedFeature`, and `TurningDatasheet` with its facts and enums —
    are no longer marked `x-toolpath-experimental`, and change only as the rest of the API does. As
    with milled features, which features a part holds and what they measure may move in any release.
  - `TurningDatasheet.slopeSpans`, `radialReachMinusZ`, `radialReachPlusZ` and `axialReach` stay
    experimental, and so does `SlopeSpan`.
  - `TurningDatasheet.approach` is new and optional: the end the feature is cut from, the same as its
    feature's own `approach`. It is absent on reports made before this release.

  **CAD formats** (`POST /v1/parts`, `POST /v1/holders`):

  - Inventor parts (`.ipt`), Solid Edge parts (`.par`), ACIS (`.sat`, `.sab`) and Rhino (`.3dm`) are
    read, beside STEP, Parasolid, SolidWorks, CATIA V5, NX and Creo, and IGES. As before, `filename`
    must carry the file's extension, which picks the reader.

  **Done regions** (experimental; `doneRegions` on `POST /v1/parts/{id}/plans`,
  `POST /v1/parts/{id}/toolpaths` and `POST /v1/plans/{planId}/toolpaths`):

  - No feature a plan machines holds a done region. A part feature that holds one is planned as what
    is left of it, read again under a `featureTag` of its own, and one whose regions are all done is
    not planned. Until now such a feature was machined whole, its done regions with it, apart from a
    direction's top.
  - A `setupPlan` may still name such a feature by its part-report tag: what is left of it is stated
    in its place, in the same setup. A profile so named states its walls as they now stand. One whose
    regions are all done states nothing, where it used to be machined.
  - So a plan's `setupPlan`, `featureTags` and `unmachined` can name tags `GET /v1/parts/{id}` does
    not list. `trimmedFeatures` is new on **Get a plan** (`GET /v1/plans/{planId}`): each such
    feature, with its `featureType`, `machiningDirection` and `regionIdxs`, and `fromFeatureTag`, the
    part feature it was cut from. It is empty where the done regions trimmed no feature, and null for
    a plan with none and for plans made before this release.

  **Plans** and estimates move: feature extraction, wall outlines, setup order, roughing passes, and
  pass time estimates all change.

## 0.11.0

### Minor Changes

- 90b9083: `waitForJob` and Python's `wait_for_job` take an optional `reconnect`. With it they open the job's event stream again when it ends early, when the connection fails, and on a 429, after its `Retry-After`, or a 5xx, waiting 1, 2, 4, then every 8 seconds by default and starting over after a stream that sent the job. A refused key (401, 403) or an unreachable job (404, 410) still rejects at once, and `giveUpAfterMs` (`give_up_after` in Python) gives up once reconnecting has failed for that long. Without `reconnect` both behave as before.

## 0.10.0

### Minor Changes

- d5621db: Add `waitForJob`, which waits for a job on the Engine API's job event stream
  (`GET /v1/jobs/{id}/events`) instead of polling `getJob`. It resolves with the job when it succeeds,
  rejects with the new `JobFailedError` when it fails, and rejects if the stream ends first: a lost
  connection, or the server closing it because the job expired or could not be read. An error
  response rejects with `ResponseError`, its body already read so the connection is freed and the
  problem details stay readable on `error.response`. It takes `onUpdate` and `signal` options.

## 0.9.0

### Minor Changes

- c15dc93: Regenerate the TypeScript SDK for Engine API 1.29.1.

  ### Engine API 1.29.1

  The `402` an out-of-quota organization receives from a metered operation is now documented. It was
  already answered; only the document did not say so.

  **Metered operations** (`PATCH /v1/parts/{id}`, `PATCH /v1/parts/{id}/features`,
  `POST /v1/parts/{id}/plans`, `POST /v1/parts/{id}/toolpaths`, `POST /v1/plans/{planId}/toolpaths`):
  - Each lists `402` (`limit_exceeded`): the organization has used its included quota for the
    operation and is out of usage credits or over its monthly spend limit. The body is the same
    problem document as before.
  - `POST /v1/plans/{planId}/toolpaths` now looks the plan up before it decides on quota, so an
    unknown plan answers `404` rather than `402`.
  - A retry with a UUID `Idempotency-Key` whose job already ran answers `202` with that job, even
    once the organization is out of quota; a key that names no earlier job is refused with `402` as
    before.
  - Repeat calls on the same part are no longer each charged. The first call of a product on a part
    is charged once, and later calls of that product on the same part ride that charge up to a
    per-part allowance that renews after a set number of calls or a set number of days.
  - With a UUID `Idempotency-Key`, an out-of-quota organization now receives `400`, `404`, or `409`
    before `402` on every metered operation: the quota refusal is decided only after the request has
    validated and its part is resolved.

  This release is additive to the contract: no field or shape changes, only the documented responses.

  ### Engine API 1.29.0

  A chamfer's bevel now states `curve`, what its surroundings allow a cone riding it, and
  `lowerAdjacentZMin` is deprecated and reads `null`. Chamfer plans move, and the turning datasheet
  changes shape. Parts and plans made from this release report `kernelVersion` 0.24.0, so feature tags
  and region indices read under an earlier one no longer apply.

  This release makes one breaking change without a major: `BevelFacts.lowerAdjacentZMin` becomes
  `number | null`.

  **Part features** (`GET /v1/parts/{id}/features`):
  - `BevelFacts.curve` is new and optional, a `ChamferCurve`: what stands around the bevel, read as
    where a cone riding it may put its rim and how wide its flat may be at each tip height. Its walls
    to either side, the room under it, and the part's bottom, or the fixture's under workholding, all
    bound it. `minU` and `maxU` are `null` where that side is open, and an element of `flat` is
    `null` where no flat is too wide at that height. It is absent where the bevel is not one a cone
    rides along, which refuses every cone, and on features enriched before this release.
  - `BevelFacts.lowerAdjacentZMin` is **deprecated**, and removed in the next major. It stays present
    and required, and its type becomes `number | null`. A feature enriched by this release reads
    `null`: the room under a bevel is now its `curve`'s, which counts the walls, the part's bottom and
    the fixture as well as the floor this field measured, so a figure read off the curve would be a
    different number under this name. Features enriched before this release keep the number they
    stored. A client that reads it as a number must handle `null`.

  **Plans** and estimates move:
  - A chamfer cone is held to its bevel's `curve`: its rim stays inside the walls to either side, its
    flat fits the room under the bevel, and its tip sinks no deeper than the part's bottom, or the
    fixture's under workholding. A bevel with no curve is offered no cone.
  - A chamfer cone sinks a minimum tip offset over every bevel, where that minimum used to shrink to
    the room the bevel had. A bevel with less room refuses every cone, and another tool finishes it
    where one fits; otherwise the chamfer is left in its setup's `unmachined`.
  - A fallback tool's `outsideCrib.reasons` no longer reads `ChamferFloorCollision`.
    `ChamferTipOffsetImpossible` reads in its place: no cone sinks the minimum tip offset over the
    bevel.

  **Turning** (experimental; `turning` on `GET /v1/parts/{id}`):
  - Every turned feature is cut from one end, and `approach` is never null on a report made by this
    release. The `unknown` feature type is gone, and `Unknown` with it from `TurnedFeatureType` and
    `TurnedOutlineFacts.kind`: what turning cannot read is no feature.
  - `TurningDatasheet.axialReach` is a `ReachCurve` from the feature's `approach` end alone, where it
    was an `AxialReach` holding a curve from each end. `AxialReach` is removed.
  - `TurningDatasheet.radialReach` is replaced by `radialReachMinusZ` and `radialReachPlusZ`, the
    radial reach to each side.
  - `TurningDatasheet.mounting` is always present, and `entryDiameter` is new and optional: for a
    feature in a hole, the narrowest diameter a bar passes on its way in from the end it is cut from.
  - `TurnedFaceFacts.normal` and `TurnedFaceGrooveFacts.normal` are removed: a face and a face groove
    face their `approach`.
  - Reports made before this release keep the turning they stored, in the earlier shape, until they
    expire; their `kernelVersion` tells them apart.

  **Stated plans** (`setupPlan`) are unchanged: each setup is still stated as its one `orientations`
  entry.

  ### Engine API 1.28.0

  A pinch point is now a point on the part, `point`, in part coordinates, and `center` — the same
  place across the tool — is deprecated and still served. More features report pinch points, and
  plans and estimates move. Parts and plans made from this release report `kernelVersion` 0.23.0, so
  feature tags and region indices read under an earlier one no longer apply.

  **Part features** (`GET /v1/parts/{id}/features`):
  - `PinchPoint.point` is new and optional, a `Vec3`: where the feature is tight, in part coordinates
    and mm, so it draws over the part's mesh as it stands. The rest of the datasheet stays in the tool
    frame of the direction the feature is machined from; the point's height in that frame, to read
    against `zMin` and `zMax`, is its dot product with the feature's `machiningDirection`. It is absent
    on features enriched before this release.
  - `PinchPoint.center` is **deprecated**, and removed in the next major. It stays present and
    required. A feature enriched by this release reads it off `point`, as `point`'s x and y in the
    datasheet's frame — the `center` an earlier release reported for the same place. Features enriched
    before this release keep the `center` they stored, and have no `point`.
  - A pinch point is not always at the feature's bottom. It is there where a width or a corner the
    clearance measured is tight, but a t-slot's and a chamfer's, sink's or slanted face's are at the
    height the clearance was measured at, a surface's is at the center of the ball that stands there,
    and a sharp inside corner's is at the middle of its edge. Draw from `point`: a cylinder of
    `diameter` standing at `center` and spanning `zMin` to `zMax` no longer describes every one.
  - More features report pinch points:
    - a t-slot, at its entry where that is narrower than the slot, on the slot otherwise;
    - a fillet or other surface whose clearance is the widest ball reaching all of it, where that
      ball is stopped, such as a fillet's dead-stopped end;
    - a chamfer, sink or slanted face, where it is tightest at one of the heights it is measured at;
    - any feature, with a `diameter` of 0, at the middle of an inside corner with no radius that
      zeroes its clearance, and once per stretch of boundary no tool reaches.

    `pinchPoints` stays capped at ten, tightest first, and empty still means nowhere to point at,
    never nowhere tight.

  **Plans**: floor-finishing and threading passes are fixed, so plans, toolpaths and machining times
  move.

  ### Engine API 1.27.1

  A plan can now be read while its toolpaths are still being cut. Until now a plan was stored only
  after every toolpath was calculated, so `GET /v1/plans/{id}` answered `plan_not_found` for the whole
  run.

  **Plans** (`GET /v1/plans/{id}`):
  - A toolpath calculation (`POST /v1/parts/{id}/toolpaths`, or a recalculation) stores the plan at
    `level: "planned"` as soon as it has planned the part, before it cuts. The setups and action-specs
    can be read at once, with no machining data; `jobId` names the job cutting them.
  - Setup and action ids read from that `planned` plan are the ones the `toolpathed` plan keeps.
  - A plan already `toolpathed` keeps its last result while it is recalculated, and its `jobId` moves
    to the new job when that run completes.
  - A failed calculation leaves the plan as its last successful run left it, or `planned` under the
    failed job for a plan that had no toolpaths. Compare `jobId` with the job you queued to tell which
    run you are reading.
  - `GET /v1/plans/{id}/toolpaths` is unchanged: it answers `409` with the job's `jobStatus` until the
    toolpaths are calculated.

  A client that treated `plan_not_found` as "still running" now sees a `planned` 200 while the job
  runs; check `level` and `jobId` before treating a plan as calculated.

  This release is additive to the contract: no field or shape changes, only when a plan becomes
  readable and the descriptions that say so.

  ### Engine API 1.27.0

  A part can be analyzed from directions its directions analysis did not choose. That analysis keeps
  only some of the directions detected on the part, and until now a plan could be stated only in
  those. Every detected direction is now on the part report, and any of them can be added to the part.

  **Part reports** (`GET /v1/parts/{id}`):
  - `discoveredDirections` is new: every direction detected on the part, best first, each
    exactly as `candidateDirections` names it. `null` on reports made before this release.
  - `addedDirections` is new: the directions the run was asked to add. One missing from
    `candidateDirections` added nothing. `null` on reports made before this release.
  - `candidateDirections` lists the analysis's choice, then the added directions it could analyze the
    part from, in the order added. Features from an added direction name it as their `machiningDirection`.
  - Without `?jobId=`, the report served is the newest of those analyzed from the most added
    directions, so two analyses finishing out of order cannot hide a direction.

  **Analyze a part** (`PATCH /v1/parts/{id}`) takes an optional body, `{ "directions": [Vec3] }`:
  - Directions are added to the part for good, after those it has, and this analysis and every later
    one — and every plan and toolpath calculation — analyzes the part from them too. A `setupPlan` can
    then state a setup in one and name its features.
  - Every feature the part had keeps its `featureTag`; an added direction brings the same features
    back under the same tags whenever it is analyzed within one `kernelVersion`.
  - Pass a direction back exactly as served. Any vector within 0.0001 of unit length is taken and
    normalized; one further off is `400 invalid_request`. A direction within 0.1° of one the part has adds nothing, and nor does one
    whose analysis fails.
  - A part takes at most 12 added directions; a request that would pass that is
    `400 too_many_directions`, and nothing is added. There is no removing one.
  - An `Idempotency-Key` replayed with other directions, or another `featureDetails`, is
    `409 idempotency_key_reused`.

  Each added direction adds a depth-map build and measurement pass to every later analysis and plan
  of the part. Measured on a 420-feature part, a plan took 12 s from the directions the analysis chose
  and about 2.7 s more per added direction, so the cap of 12 holds a plan to about four times that; a
  small part's plan grew by about 0.1 s per direction.

  This release is additive to the contract.

  ### Engine API 1.26.0

  Threaded holes are tapped. Parts and plans made from this release report `kernelVersion` 0.22.0, so
  feature tags and region indices read under an earlier one no longer apply.

  **Threads** (`GET /v1/parts/{id}/features` and the plan routes):
  - A hole with a modeled thread is now measured as threaded. Where the catalog lists that thread —
    ISO metric 6H, Unified 2B, and the straight American and British pipe threads — the hole's
    `HoleFacts.threading` names it and how it is cut: a cutting tap, or a thread mill for a
    left-hand thread or one wider than taps are stocked. The hole's `diameter`, its drill window
    (`minDrillDiameter`, `maxDrillDiameter`) and `maxEndmillDiameter` are its thread's tap drill
    rather than the modeled minor diameter: 5.0 mm for an M6x1, where it read about 4.92 mm.
  - Plans cut those threads. The `tap` family makes the tap or thread mill each one needs, and the
    plan taps or mills the hole after drilling it. A thread with no tool for it — under a crib with
    `tap` off, say — leaves its hole listed in its setup's `unmachined`.
  - Releases 1.20.0 and 1.23.0 described threaded holes being tapped, but no hole was measured as
    threaded until this release: no datasheet carried `threading` and no plan tapped a hole. Plans,
    machining times and tool counts of parts with modeled threads move as they gain those passes.
    Features measured before this release keep the datasheet they stored.
  - An external thread, and an internal one the catalog does not list, are measured and planned as
    before.

  **Plans** and estimates move:
  - A chamfer or slanted face taller than 1/4" is roughed and then finished, where it was finished
    with nothing roughed ahead of it, and is no longer held back until the surfaces around it are
    machined. A countersink, and a bevel no taller than that, are planned as before.
  - A chamfer tool's tip reaches at least 0.01" below its bevel, or as far as the room under the
    bevel allows, with its holder clear of the material there. A tool barely taller than its bevel,
    or one whose holder cannot follow it down, is no longer made for it, and a chamfer pass cuts to
    the depth its tool was chosen for.

  **Turning** (experimental; `turning` on `GET /v1/parts/{id}`):
  - A turned feature is cut whole from one end of the part, which its new `approach` names:
    `PlusZ`, the end `frame.direction` points toward, or `MinusZ`, the other. A stretch of the
    outline both ends reach is two features, one per end, with the same `featureType` and
    `regionIdxs`, so `features` lists it twice and `approach` tells the two apart. An OD or ID
    profile is split where the end reaching it changes. `approach` is null for an `unknown`
    feature, which no cut reaches, and absent on reports made before this release.
  - Every turned feature's `featureTag` changes: the tag now includes the end it is cut from.
  - A turned thread, and an axial hole it is cut in, name the same catalog thread as before.

  This release is additive to the contract: `TurnedFeature.approach` is new and optional, and
  descriptions in the datasheet components changed. Plans, machining times, tool counts, hole
  datasheets and turned features move with this release.

  ### Engine API 1.25.0

  Part analysis reads a part for turning, beside milling. Turning is **experimental**, like plans
  and toolpaths: it may change in breaking ways in a minor release, and is flagged
  `x-toolpath-experimental` throughout the document. Parts and plans made from this release report
  `kernelVersion` 0.21.0, so feature tags and region indices read under an earlier one no longer apply.

  **Part reports** (`GET /v1/parts/{id}`):
  - `turning` is new: what reading the part for turning came to, a `Turning` narrowed on `kind`, or
    `null` where no reading was taken (reports made before this release). `Turned` carries the axis
    it turns about (`frame`, and `axisSource`), its `areaFraction` and `turnability`, its `outline` in `(z, r)`, its
    `features` in outline order — each with a `featureTag` and a snake_case `featureType`
    (`od_groove`), both as a milled feature's are, and the `regionIdxs` it was spun from — and what
    turning leaves for milling: `regionIdxsLeftForMilling`, the regions, and
    `featureTagsLeftForMilling`, the milled features with a region among them. `NoAxis`,
    `BelowThreshold`, `SpinFailed` and `NotRequested` say why there is no turned part.
  - Analyzed with `featureDetails=true`, each turned feature carries its `TurningDatasheet`: its
    extent in `(z, r)`, how a tool must be mounted to reach it, its slopes, its radial and axial
    reach, and a per-kind `facts` object narrowed on `facts.kind`. It is `null` otherwise, for an
    `unknown` feature, and for a feature that could not be measured.
  - `turnability` keeps its shape, and is now read off the same reading as `turning`, so the two
    agree: a `Turned` part is its `TurningAxis`, and every other kind its `NoAxis`. Its scores can
    move a little with the kernel's fixes to turned outlines.

  **Experimental** means one thing everywhere: plans, toolpaths and turning may change substantially
  in a minor release — reshaped, renamed, or removed — where the rest of the API keeps breaking changes
  for a major version, apart from small ones with no material effect on clients. Every breaking change
  is listed in that release's notes. Plans and toolpaths, called early access until now, take
  the name the `x-toolpath-experimental` flag already had; the flag is unchanged. The notice is said on
  each experimental operation and on the `turning` field; kernel types tp-kernel tags experimental,
  which used to carry a notice of their own, carry the flag.

  **Clearer reference.** A field holding a component names it — `Vec3`, `ReportUnits`, `AxisSource` —
  where it read as an anonymous object, and `PartFeatureEntry.datasheet` is required, as it is always
  present: null where there is no datasheet yet.

  Features move a little with the kernel's fixes to modeled-thread detection — two modeled threads on
  one cylinder now read as two, and neither a helical slot nor a square-walled helical groove reads as
  a thread — datasheets with its fixes to wall clearance, and plans, their actions and their
  toolpaths with its improvements to strategy results.

  This release is additive to the contract: `turning` and its components are new.

  ### Engine API 1.24.0

  Plans can now hold the part in a vise. The plan routes take a new optional `workholding`:
  `thinAir`, the default, plans as before, and `syntheticVise` holds the part in a vise sized to
  whatever it closes on, so a jaw blocks the reach it really would. Parts and plans made from this
  release report `kernelVersion` 0.20.1.
  - **The first setup grips the stock, every later one the part.** The vise closes on the initial
    stock in the first setup, since nothing has been cut yet, and on the part as cut in every setup
    after it. Its jaws close along each setup's y.
  - **The planner chooses the first setup.** Every direction is measured both ways, and the plan
    starts in whichever direction, gripped on the stock, gives the best plan. Outer walls are
    profiled full depth in that first setup, where the jaws hold only the stock beneath the part,
    rather than in a later one where the jaws would be in the way.
  - **One grip.** The jaws reach 5.35 mm up whatever they close on, stock or part, and never more
    than half its height. On the default Flat Bar that stops them 1 mm below the part; stock that
    leaves less under the part is gripped by the part as well, as a vise has to grip it.
  - **What the jaws leave out of reach.** A face no setup can reach past the jaws is reported in the
    plan's `issues`, as any unreached face is.
  - **A stated plan still comes first.** A `setupPlan` whose first setup cannot start gripped on the
    stock fails, its `error` beginning `refused_user_plan:`. A plan that states its first setup
    measures each direction once, as thin air does, rather than twice.
  - **A part no first setup can hold.** A job no direction can start gripped on the stock fails, its
    `error` beginning `invalid_argument: setup planning: no fixture on the initial stock holds a first
setup`.
  - **The plan keeps it.** The queued-job response echoes `workholding`, and a plan read serves the
    workholding its job held the part by as `workholding`. A recalculation that names none is held as
    the plan was, like its stock. One that changes the workholding, or the stock under a vise, does
    not carry the plan's `setupPlan` or `doneRegions`, as for a new crib. Plans made before this
    release, and replayed jobs recorded before it, read `thinAir`.

  Planning in the vise measures every direction twice, so it takes longer than planning in thin air:
  about a third more planning time in our tests, with toolpath time and peak memory about unchanged.
  Without `workholding`, plans are unchanged.

## 0.8.1

### Patch Changes

- f244263: Release the Python SDK (`toolpath`) as a wheel on a GitHub release, under the same version as `@toolpath/api`.

## 0.8.0

### Minor Changes

- 1495e2b: `createToolpathClient` exposes every generated API. `toolpaths` (create and recalculate toolpaths,
  read toolpaths and machining times), `toolHolders` and `demo` were generated but unreachable from
  the client, so callers built those requests by hand.

## 0.7.0

### Minor Changes

- e434f5a: Regenerate the TypeScript SDK for Engine API 1.23.0.

  ### Engine API 1.23.0

  A surface states the tools its shape admits as a curve, `bullnoseCurve`, in place of `toolFit`,
  which is deprecated and still served. Pipe threads are tapped, and plans and estimates move. Parts
  and plans made from this release report `kernelVersion` 0.20.0, so feature tags and region indices
  read under an earlier one no longer apply.

  **Part features** (`GET /v1/parts/{id}/features`):
  - `SurfaceFacts.bullnoseCurve` is new and optional, a `BullnoseCurve`. `cornerRadius` runs up from
    0 (a flat bottom) to the largest corner a tool reaching all of the surface may have, and
    `bottomDiameter` holds, beside each corner, the widest flat bottom `D − 2r` a tool with that
    corner may carry. Its description says how to read it between the corners it stores. An element
    is `null` where nothing limits it: a `null` bottom limits nothing at its corner, and a `null`
    last corner means the curve is unbounded throughout. It is absent on features enriched before
    this release.
  - `SurfaceFacts.toolFit` is **deprecated**, and removed in the next major. It stays present and
    required, and `ToolFitResult` stays in the document with it. Its three figures are the curve's
    ends, and a feature enriched by this release reads them off it: `cornerRadius` is the last
    corner, `toolDiameter` twice that plus the last bottom, and `toolBottomDiameter` the first
    bottom, each absent where the curve holds none. Features enriched before this release keep the
    `toolFit` they stored.
  - `ThreadSpec.threadProfileDeg` and `threadTaperDeg` are new and optional: the thread's form, as the
    included angle between its flanks (absent, 60°; the British threads are 55°), and its taper, as
    the half angle of its pitch cone (absent, 0, a straight thread).
  - Features move. A part whose outline is one cylinder has a `Wall` beside its `Profile`, and a
    stud, a round collar or a round boss with no blend at its foot keeps its kind under a new tag.
    About two in five of the undercut walls and t-slots across our test parts are gone: most
    were a floor, ceiling or pocket read from the side, and the t-slots among them were ones no
    cutter could reach.

  **Threads** (`toolCrib` on the plan routes):
  - Pipe threads are tapped. A tapered thread (NPT, NPTF, Rc) gets a cutting tap of its taper, run its
    standard's length in from the face, and its hole is drilled straight to its tap drill. Nothing
    else cuts a tapered thread yet, so one whose thread names milling or forming, or one past the tap
    ceiling, is owed its thread. The straight American (NPSC, NPSM, NPSL, NPSF) and British (G) pipe
    threads are tapped like any other. By default taps reach 2" pipe and G 2 or Rc 2, the tap ceiling
    now being 2.5" or 65 mm; a library's `tap.maxDiameter` still clips it. The default crib's drills
    stop short of those sizes' tap drills (2 3/16" and 2 7/32" for 2" pipe, 57 mm for G 2, 56 mm for
    Rc 2), so under it those holes are not drilled to their tap drill; a library whose drills reach
    those sizes drills them.
  - A tool cuts only a thread of its own form and taper. `PlanAction.tool` on a tap or thread mill
    carries `threadProfileDeg` and `threadTaperDeg`.

  **Plans** and estimates move:
  - A whole-part rough cuts each floor it covers to the floor plus the axial allowance. It used to
    leave a film that the next pass milled off the whole floor at its own stepover; on one part the
    roughing after the sweeps takes a tenth of the time it did.
  - Chamfering, rounding and undercutting passes take the tool that costs their stage the least
    time, tool changes included, rather than the stiffest and widest, so a plan may run a slenderer
    tool.
  - A keyseat or dovetail cutter for a tall groove is widened until its flute is at most half its
    width; a keyseat cutter held narrower cuts its slot in levels. A shallow groove that was refused
    for want of a neck that holds up gets a wider cutter.
  - A three-dimensional surface admits wider tools at smaller corners, and refuses a tool that
    collides with it at its corner.
  - A tool on a through feature is held to the whole distance its pass runs past the far face, so a
    drill is made long enough to break through.
  - Roughing ramps into material at the tool's ramp feed, and estimates count the ramp into a hole or
    a closed pocket.
  - The drill series run past an inch, to 4 1/4" and 57 mm, so a plain hole at one of those sizes is
    drilled rather than milled. A library that states no drill `maxDiameter` stocks all of them; the
    default crib, used when a request names none, now states 2" (50.8 mm) for its inch drills and
    50 mm for its metric ones.

  **Part reports** (`GET /v1/parts/{id}`) — `turnability` judges the axis on the volume the part keeps
  of what spinning it sweeps, so small turned parts and thin discs are found, a hex body or a sprocket
  is refused, and a part turned whole scores exactly 1 by volume. A part that cannot be spun about its
  axis reads `NoAxis`, where the reading used to fail and `turnability` read `null`.

  This release is additive to the contract: `bullnoseCurve`, `BullnoseCurve` and the two `ThreadSpec`
  fields are new and optional, and `toolFit` and `ToolFitResult` are deprecated but still present and
  required. Plans, machining times, tool counts and the features a part reports move with this
  release.

  ### Engine API 1.22.0

  Plans can now give every pass a tool, even where the tool crib has none. The plan routes take a new
  optional `fallbackTools` (default false). With it, a pass that no tool of the crib can play gets a
  tool from a last, fallback tier made with the reach limits lifted, so the part has a time for the
  work. Common causes are a hole deeper than the crib's drills reach, a pocket past its endmills'
  `maxLengthOverDiameter`, and a head no library lists.
  - **The crib comes first.** The fallback tier is made only for the features the crib's tools leave
    owed a pass, and it is planned after every crib tier. A pass any crib tool can play keeps that
    tool, so a feature the crib roughs but cannot finish is roughed as before and finished with a
    fallback tool.
  - **As near the crib as it can be.** The fallback is a ladder, each rung only for what the ones
    before still leave. First each library of the crib as it is (its diameters, its system, its
    series, its heads) with reach lifted, in crib order, so a deep hole gets the library’s own
    drill, longer. Then the kernel’s defaults with reach lifted, for a head no library lists or a
    diameter outside every library’s range.
  - **The planner still chooses the crib.** A feature only a fallback tool cuts is offered to setup
    planning only where it covers a face no feature the crib machines whole does, so a direction the
    crib machines is not traded for one that needs a fallback tool. A face the crib can only rough is
    offered its fallback readings too. A stated feature is offered whatever it needs.
  - **Each fallback tool is marked.** `PlanAction.tool` gains `outsideCrib: { reasons }`: the kernel's
    `Rejection`s for why no crib tool fit the passes that action's features were owed. A fallback
    tool the crib also made, with an equal `key`, is the crib's and is not marked.
  - **What a feature still can't get.** One the kernel cannot measure, or one whose geometry admits no
    tool at any reach, is still `unmachined`.
  - **The setting is echoed back.** The queued-job response echoes `fallbackTools`. It is not carried
    by a recalculation, so state it on each request that wants it. A replayed job recorded before
    this release reads `false`.

  Without `fallbackTools`, plans are unchanged.

  ### Engine API 1.21.1

  A feature a request's `setupPlan` states is now offered to the planner even when no tool in the
  job's crib can cut it. 1.21.0 offered the planner only the features some tool could cut, so a
  stated feature with none — typically one a caller pinned to machine a face nothing else covers —
  failed the job as `refused_user_plan` with `feature … is not among the features offered`. Such a
  feature is now planned where it is stated, and the passes it is owed but has no tool for are
  reported as the setup's `unmachined`, as for any other feature.

  A stated feature the part could not be measured for is still refused that way. Nothing in the
  contract changed.

  ### Engine API 1.21.0

  A quote can now say what stock the part is cut from, and the toolpaths read shows the stock as each
  action leaves it.
  - **Create a plan** (`POST /v1/parts/{id}/plans`), **Calculate toolpaths**
    (`POST /v1/parts/{id}/toolpaths`) and **Calculate a plan’s toolpaths**
    (`POST /v1/plans/{planId}/toolpaths`) accept optional `stock: { mode: ..., ... }` beside `material`.
    The input policy has all lengths in mm and is told apart by `mode` alone:
    - `automaticFlatBar`: a block sized around the part by optional oversize, grip and rounding
      figures (`{ "stock": { "mode": "automaticFlatBar", "oversizeX": 1 } }`).
    - `automaticRoundStock`: a cylinder sized the same way (`radialOversize`, `axialOversize`,
      `gripStock`, `diaRoundToNearest`, `lengthRoundToNearest`). It lies along the part’s long side
      unless `verticalAxis` stands it up.
    - `fixedBox` (`dimensions`) or `fixedCylinder` (`diameter`, `length`), placed by `position`
      (`modelCentered`, `offsetFromTop`, `offsetFromBottom`) and `positionOffset`. A fixed cylinder
      stands along the first setup’s cutting direction.

    Round stock of either kind is centered on the part’s smallest enclosing circle about its axis.
    The document states the union as `oneOf` with `mode` as its discriminator.

  - An omitted figure means the default and is never filled in: a plan and a 202 echo the option
    exactly as it was sent. `positionOffset` omitted means 0.
  - A fixed block’s `dimensions.x` and `dimensions.y` are its two sides across the cutting direction,
    in either order: the longer runs along the part’s long side, as the block would be loaded.
  - Stock is held to the legacy app’s 80 × 50 × 30 in (2032 × 1270 × 762 mm) envelope:
    - **Blocks:** the two sides across the cutting direction must fit 2032 × 1270 mm in either
      order, and the thickness along it (`z`) is at most 762 mm. A block stood on end is refused,
      because depth is what drives a job’s memory.
    - **Cylinders:** the box diameter × diameter × length must fit the envelope in some order.
    - `positionOffset` is within ±2032 mm, and every automatic oversize, grip and rounding figure is
      at most 762 mm (30 in).
    - A request past a limit answers 400 `invalid_request`, and its `detail` names the field and
      the sides it came to.
  - Automatic stock is sized around the part when the job runs, so it is held to the same envelope
    then. Stock that comes to more — the maximum oversize around a small part, or any part too large
    for the envelope — fails the job, and the job’s `error` gives the size it came to.
  - Fixed stock the part does not fit in also fails the job: the job’s `error` says how far the part
    stands outside it. Neither failure is retried, since every retry would be refused the same way.
  - Without `stock`, a new plan is cut from automatic Flat Bar at the default figures — exactly
    the stock it was cut from before — and **Calculate a plan’s toolpaths** reuses the stock option
    the plan was last made with.
  - **Get a plan** and **Get machining time** return one `stock` object containing `input`, the
    saved policy, and `resolved`, the initial geometry calculated from it. A plan made before inputs
    were recorded shows automatic Flat Bar. Missing geometry is `resolved: null`.
  - The 202 of all three POSTs returns `stock: { input: ..., resolved: null }`: the accepted policy,
    with geometry available on the plan after the job succeeds. A recalculation's 202 describes the
    queued calculation, not the previous plan's geometry.
  - Requests accept the policy directly as `stock`, with no `input` wrapper. Sending a response's
    `{ input, resolved }` envelope, calculated geometry, an empty stock object, or the old top-level
    `stockOption` field answers 400. Omit `stock` to use the defaults or saved input.
  - **Calculate a plan’s toolpaths** keeps every setting the body leaves out — material, tool crib,
    machine and stock — from the plan. Before, a body that named some but not all of them replaced
    the plan’s tool crib with the default crib and its machine with none.
  - An `Idempotency-Key` on **Calculate a plan’s toolpaths** now matches on the request body as sent,
    not on the settings it resolved from the plan. A retry of the same request replays even when
    another recalculation has changed the plan since. The same key with a different body is still
    `409 idempotency_key_reused`.
  - The `stock.resolved` on **Get a plan** (`GET /v1/plans/{planId}`, which now carries it too) and **Get
    machining time** is the stock the kernel sized and placed, tagged by `shape`:
    - a `StockBox` (`shape: "box"`), unchanged but for the new tag;
    - or, for round stock, a `StockCylinder` (`shape: "cylinder"`, `origin`, `axis`, `diameter`,
      `length`).

    **Check `stock.resolved` for null and narrow on its `shape` before reading its geometry.**
    Block corners are now `stock.resolved.lower` and `stock.resolved.upper`.

  - **Get toolpaths** (`GET /v1/plans/{planId}/toolpaths`) carries `initialStockUrl`, and each action a
    `stockAfterUrl`: 15-minute links to the stock as a GLB mesh (part coordinates, mm) before the first
    action and after each one. An action that was refused or cut nothing has none; show the previous
    action’s mesh, then the initial stock, then the plan’s `stock.resolved` figure.
  - These stock meshes are plain GLB, the same encoding as the part mesh (`meshGlbUrl`), so any tool
    that reads glTF opens them with no extension to support. They are stored gzipped, a little over a
    third of their plain size, and served with `Content-Encoding: gzip` whatever the request’s
    `Accept-Encoding`. Browsers and `fetch` undo that on their own. curl without `--compressed`, wget,
    Python’s `urllib`, and Java’s and .NET’s HTTP clients by default save the gzipped bytes, which
    must be gunzipped before the GLB is parsed. The part mesh itself is unchanged.
  - Every `invalid_request` 400, on every endpoint, now says in `detail` which field failed and why —
    `stock.position: Invalid option: expected one of …`, `query.filename: Too small: …` — where
    it used to carry only the code.

  This release changes the stock contract on experimental endpoints during beta: `stockOption` moves
  to `stock` in requests, and the existing resolved `stock` figure moves to `stock.resolved` in
  responses. Clients must update those paths. The worker payload and stored data keep their shapes,
  so no database migration is required. Regenerate the public SDK from this release's OpenAPI
  document when publishing.

  ### Engine API 1.20.0

  This release moves the Engine API from tp-kernel 0.18.0 to 0.19.0. Threaded holes get their
  threading tools, and a plan now covers features the tools can cut only part of. No request or
  response schema moves; plans and machining times do.

  **Threads** (`toolCrib` on **Create a plan**, **Calculate toolpaths** and **Calculate a plan's
  toolpaths**):
  - **The `tap` family now makes tools.** It is every tool that cuts a thread: cutting taps, forming
    taps and single-form thread mills. The kernel makes one only for a threaded hole, of the process
    its thread names (`threading.process`), and a tap only at a standard thread size. Its
    `minDiameter` and `maxDiameter` clip all three. Before, `tap` was accepted and made nothing.
  - The default crib has `tap` on in inch sizes, as it always has, so a job that names no crib now
    taps and thread-mills its threaded holes. A crib with `tap` off leaves each thread owed.

  **What a plan covers:**
  - **Features with only some of their passes are planned.** tp-kernel 0.19 judges each feature on
    every pass it is owed — rough, finish, thread. A feature a tool can rough but not finish, or a
    hole the tools can drill but not thread, is still planned for the passes it has, and its missing
    pass is reported: the feature is listed in its setup's `unmachined`. Before, a thread was not
    judged at all, and a feature with no finishing tool was planned or left out as a whole.
  - **Fewer tool changes.** A wall's rough and finish are planned among the other features' passes,
    so a wall is cut by the tool already in the spindle where one fits. A wall rough's time counts
    the laps it runs down the wall.
  - **Tool sizing:** endmill, bullnose, ball and chamfer-mill entries make nothing narrower than 1/32"
    (0.8 mm) unless the library states a range. A keyseat or dovetail cutter is the widest the groove
    admits with a neck of 0.2–0.4 of the cutter, and a groove too narrow for that is refused. A
    surface's terminal rougher is held to the surface's flat bottom.

  **Stated plans** (`setupPlan`, 1.19.0):
  - **A statement is planned as stated wherever it fits the features offered.** A profile stated after
    the first setup, an edge break stated ahead of the surfaces it breaks, and a feature the planner
    would leave out on its own are each machined where stated, where 1.19.0 failed the job as
    `refused_user_plan`. A stated setup with nothing to machine is omitted. A statement is still
    refused when a direction or feature it names is not offered.

  This release is additive to the contract. Machining times, tool counts and the features reported
  unmachined move for any part with threads, walls, bevels or undercuts.

  ### Engine API 1.19.0

  A plan can now be stated rather than only taken as the kernel makes it: which setups machine the
  part, in what order, from which direction, and which features each takes. tp-kernel plans from such
  a statement, and this release passes it through. A caller can also say which regions are already
  finished.

  **Stating a plan** (`setupPlan` on **Create a plan** (`POST /v1/parts/{id}/plans`), **Calculate
  toolpaths** (`POST /v1/parts/{id}/toolpaths`) and **Calculate a plan’s toolpaths**
  (`POST /v1/plans/{planId}/toolpaths`)):
  - The body takes `setupPlan`: `{ setups: [{ orientations: [{ direction, features }] }] }`. Each setup
    names one direction for now, and the features (`featureTag`, hex) to machine from it. Features
    are measured in thin air, which holds one direction per setup, so a 3+2 setup is not stated yet;
    a setup with more than one orientation is a 400. A direction must be one a feature of the part
    was extracted from, passed back exactly as served — a unit vector, or it is a 400 — and a feature
    is named under its own direction.
  - The plan made **extends** the statement: the stated setups come first, in the stated order, each
    holding at least the features named — and every other offered feature of its direction — and
    the kernel appends setups where the part needs more. A feature named has to be offered: one no
    tool in the crib cuts is not.
  - **A statement the kernel cannot honor fails the job** instead of being planned around. The job
    reads `failed`, is not retried, and its `error` (`GET /v1/jobs/{id}`) begins `refused_user_plan:`
    with one clause per refused statement.

  **Done regions** (`doneRegions`, on the same routes):
  - `doneRegions` is `{ kernelVersion, regions }`: indices into the part report’s `regions` that are
    already at their final surface — near-net stock, a face finished before the part arrives — and
    the `kernelVersion` of the report they were read from.
  - **The kernel version is required.** A region’s index is stable only within one kernel release, and
    a stale index still names some region. A job planned by another release fails for good, its
    `error` beginning `stale_regions:`; an index the part does not have fails it as
    `unknown_regions:`. A caller re-reads the part report and states the regions afresh.
  - What a done region does: it is left out of the plan’s `issues`, its machining times and its
    toolpaths. A feature whose regions are all done is not planned, unless `setupPlan` names it — then
    it is machined, and its regions still do not count toward `issues`. A done region on the top of a
    direction turns off facing from that direction, and the other top faces are machined one by one.
    The stock is unchanged: still the block around the part, so the simulation cuts air over a done
    region.

  **Reading and recalculating:**
  - **Get a plan** (`GET /v1/plans/{planId}`) serves the plan’s own `setupPlan` — every setup in order,
    its direction, and the features planned from it — and the `doneRegions` it was told. Sent back
    with the same done regions, tool crib, material and machine, under the same `kernelVersion`, the
    statement plans the same, so it is what a caller edits to restate the plan. Both are null for
    plans made before this release. An empty `issues` means the plan machines everything it owes
    _except_ its done regions, which the caller vouched for.
  - The ack (202) echoes `setupPlan` and `doneRegions`, or `null` when the job has none. An
    Idempotency-Key reused with a different statement is refused as `idempotency_key_reused`.
  - **Calculate a plan’s toolpaths** keeps the plan’s statement and done regions when the body omits
    them, and clears either given `null`. It carries neither over a body that names a new `toolCrib`,
    `material` or `machine`, which change what is offered: those are echoed as `null`, for the caller
    to restate.

  This release is additive. No existing field changes shape, type or requiredness; the new request
  fields are optional, and a request that names neither plans exactly as before.

  ### Engine API 1.18.0

  This release moves the Engine API from tp-kernel 0.17.0 to 0.18.0. A tool crib's libraries become
  priority tiers, a library's missing families fall back rather than refuse, the machine's `maxRpm` is
  applied, and the toolpath geometry file changes shape. No request or response schema moves except
  one new optional datasheet field; see the end of this note.

  **Tool cribs** (`toolCrib` on **Create a plan**, **Calculate toolpaths** and **Calculate a plan's
  toolpaths**):
  - **Library order is priority.** Each pass of the plan uses the first library with a tool for it.
    Before, the libraries were pooled, and where two made the same tool the first one's was kept.
  - **A library missing a family falls back** where the kernel can, instead of leaving the feature
    unmachinable:
    - no drills: holes are milled, except holes that must be drilled — a cone bottom, or a `Drill`
      hole process;
    - no chamfer mills: bevels are followed by a bullnose, then a ball;
    - no face mill: facing uses a flat endmill;
    - no bullnoses: surfaces are followed by a ball;
    - no ball or bullnose: an outer fillet gets a corner rounding mill, where corner rounders are
      enabled.
  - **A feature may be planned with a tool made for another feature**, even where none was made for
    it.
  - **Endmill `minDiameter` is a hard minimum.** Before, it was a preference the kernel went below at
    a sharp corner. A stated minimum is also now the width under which a sharp corner is refused, in
    place of the kernel's default of 1/4" or 6 mm.
  - **Drills:**
    - inch drills are the fractional, number and letter series, and metric drills the metric series.
      A library enabling both makes the nearest stocked size of either, one drill per hole, unless
      its two blocks state different `maxLengthOverDiameter`, when each system's drills are made
      separately and a hole may get one of each;
    - the nearest size within tolerance is chosen, and no custom size or point is ground. A hole that
      must be drilled with no stocked size within tolerance is unmachinable, cone-bottom holes over 1"
      among them. A hole with a stocked size below its tolerance is drilled at that size as a roughing
      pass and left owed its finish, which the setup reports in `unmachined` where nothing else can cut
      it. A library with inch drills alone does that to any metric-sized hole that must be drilled — a
      Ø3.4 mm cone-bottom hole is roughed with a 1/8" drill — and enabling metric drills finishes it;
    - drill points are 118°, 120° or 135°.
  - **The default crib's drills come in both systems.** Omitted, `toolCrib` is still one implicit
    library with every family inch-sized and corner rounders off, but its drills are now enabled in
    inch and metric sizes: a part's units are not known before it is uploaded, and a hole is drilled
    at the nearest stocked size within its tolerance, so a metric-drawn hole takes a metric drill.
    1.16.0 documented the default as inch-only, and the kernel then sized drills from every series
    regardless, so this keeps what the default did rather than changing it.
  - **Corner-rounding `minDiameter` and `maxDiameter`** both refer to the whole cutter; `minDiameter`
    used to refer to its bottom.
  - **Metric families use metric defaults** — a 20 mm endmill ceiling, a 50 mm face mill, a 6 mm
    preferred minimum and a 500 mm longest tool — where they took the inch figures.
  - **`tap` has no effect.** It is still accepted; the kernel synthesizes no taps or thread mills yet.

  **Machines** (`machine` on the same routes) — **`maxRpm` is applied.** Every synthesized tool is
  held under it, so machining times move for a machine that states one: slower below 15000 rev/min,
  faster above. Without a machine, or without `maxRpm`, the kernel's default ceiling of 15000 rev/min
  applies, as before. Tool changes are still never included; `toolChangeSeconds` is for the caller to
  price them.

  **Plans** are made by tp-kernel 0.18.0, and estimates move:
  - A surfacing pass is estimated longer, several times longer on a narrow face, and a slanted face is
    surfaced by the quickest of the stiffest tools.
  - Fixed: a boss's roughing, which came out empty; a chamfer's setup order, which left bevels
    unmachined; and an undercut that left a flange a rapid plunged through.

  **Toolpath geometry** (`toolpathUrl` on `GET /v1/plans/{planId}/toolpaths`) — the file carries
  `points` in part coordinates and no `frame`: place them as they are. A file written before this
  release still carries `frame` and points in the pass's frame, until its part expires (15 days after
  upload) or its plan's toolpaths are recalculated, which rewrites its files. A file with a `frame`
  needs placing through it; one without does not.

  **Part features** (`GET /v1/parts/{id}/features`) — `ThreadSpec.handedness` is new and optional,
  `Right` or `Left`; absent means right-hand. It is absent on features enriched before this release.

  This release changes types without a major, as the contract does while in beta: the toolpath
  geometry file loses `frame`, and `ThreadSpec` gains an optional `handedness`. The generated SDK sees
  only the latter; the geometry file is fetched from `toolpathUrl` outside it.

  ### Engine API 1.17.0

  This release moves the Engine API from tp-kernel 0.15.0 to 0.17.0. Datasheets stop serving `null`
  in numeric fields, and plan actions report what kind of pass they are as `intent`, in place of
  `planCase`. Both change SDK types; see the end of this note.

  **Part features** (`GET /v1/parts/{id}/features`) — every number in a datasheet is now a number.
  Eleven fields used to arrive as `null` where nothing bounded them, although the document declared
  them numbers. They are now **optional**, and left out in exactly that case:
  - `CdBounds.min` and `max` — absent where no tool is too wide to reach every point of the feature
    (`min`), or to fit in it at all (`max`). Both are absent where nothing encloses the feature, as for
    a facing pass, and `min` is absent only where `max` is.
  - `CdData.terminalCornerRadius` — absent where no corner radius is too large: on a surface, where
    nothing bounds a ball; on any other kind, where no blend calls for a corner.
  - `SurfaceFacts.maxBottomDiameter` — absent where nothing on the surface limits a flat bottom.
  - `ToolFitResult.cornerRadius`, `toolDiameter` and `toolBottomDiameter` — each absent where the
    surface's shape does not limit it; where `cornerRadius` is absent, so are the other two.
  - `TslotFacts.maxEntryCd` — absent where nothing above the slot limits the tool that comes down to
    it.
  - `TslotFacts.undercutDepth` — absent where the slot has no valid measurement, which
    `isInvalidGeometry` or `cd.measurementFailed` says.
  - `DovetailFacts.topOpeningWidth` and `bottomOpeningWidth` — absent where nothing closes the opening
    at that height.

  Features enriched before this release keep the datasheets they were stored with, so they go on
  serving `null` in these fields until they expire with their part, 15 days after upload.

  Two fields are **new**, and absent on features enriched before this release:
  - `CdData.measurementFailed` — the clearance measurement was owed and failed, so every regime reads
    zero and no tool is offered on its strength. Never set on a hole or a facing pass. On a chamfer it
    is the surface half's: the tools that follow the bevel are refused, and the cone is still offered.
  - `TslotFacts.isInvalidGeometry` — the slot was measured and is not one a disc cutter can cut. Its
    clearance then admits no tool.

  Five fields are **deprecated**, and removed in the next major. Each stays present and required.
  - `DovetailFacts.isInvalidGeometry` — the kernel reports a width that failed to measure as
    `cd.measurementFailed` now, and a dovetail enriched by this release reads that value here. Despite
    the shared name it is not the t-slot's new flag: on a dovetail it means a width failed to measure,
    on a t-slot that the slot was measured and cannot be cut.
  - `maxBottomDiameter` on `FaceFacts`, `PocketFacts` and `BossFacts`, and `HoleFacts.maxSpotDiameter`
    — nothing ever computed them, so they have always read `null`, and still do. The document now
    types them `number | null`.

  **Plans** (`GET /v1/plans/{planId}`, `/machining-time`, `/toolpaths`) — each action carries
  **`intent`**, what kind of pass it is: one of `Rough`, `AdaptiveRough`, `TraditionalRough`,
  `Rough3d`, `RoughSlot`, `Finish`, `FinishWall`, `FinishFloor`, `FinishFillet`, `Spot`, `Thread`,
  `DirectCountersink` or `CountersinkSpiral`.
  - **`planCase` is removed.** tp-kernel no longer reports a pass's concrete strategy, only its
    intent, which is coarser: a whole-part rough reads `AdaptiveRough`, and a drill finish, a facing
    pass, an undercut and a chamfer all read `Finish`.
  - Plans made before this release carry `intent` too, given from the strategy they recorded.

  Plans are made by tp-kernel 0.17.0:
  - A surface whose every layer failed to measure now reads `cd.measurementFailed`: no tool is made
    for it, and the regions only it holds come back as an `OutOfPlay` issue. It used to be planned as
    if its shape alone bounded it, or, where convex, as if nothing did. On a chamfer only the tools
    that follow its surface are refused; a chamfer cone is still made and planned.
  - A setup from a direction where the vise grips the part unsteadily — the part standing more than
    six times as tall as the narrower side of what the jaws hold, like a plate on its edge — comes
    last, and machines only what nothing steadier reaches.
  - A wall's or a through feature's `reachCurve` stands the material around it over its extended
    bottom, so it reads taller where the bottom edge climbs, and tools are held clear of that height.
  - A wall finish over a pocket, boss or blind hole with a floor blend stops where the blend meets the
    wall.
  - A feature tag (`featureTag`, `featureTags`) and a region index are stable across runs of one
    kernel version, not across versions: a plan's tags name the features of its own `kernelVersion`.

  **Jobs** — a job whose part or holder file cannot be read now fails with an `error` beginning
  `io:`, and one in a format the kernel does not read with `unsupported:`; both began `geometry:`.

  This release changes types without a major, as the contract does while in beta: eleven datasheet
  fields become optional, four become `number | null`, and `planCase` is removed from the three plan
  action shapes in favour of `intent`. A datasheet the kernel enriches still carries what clients
  already received for those fields, except that an unbounded one is left out rather than `null`.

  ### Engine API 1.16.0

  A quote can now describe the tools its shop runs, so a plan's tools — and the machining times off
  them — come from the shop's tooling rather than one generic pool.
  - **Create a plan** (`POST /v1/parts/{id}/plans`), **Calculate toolpaths**
    (`POST /v1/parts/{id}/toolpaths`) and **Calculate a plan’s toolpaths**
    (`POST /v1/plans/{planId}/toolpaths`) accept an optional `toolCrib` in the JSON body: a **tool
    crib** of one to sixteen **tool libraries**, in order: where two libraries make the same tool,
    the first one's is kept.
  - Each library has a `kind`. Today the only kind is `implicit`: an **implicit tool library**, whose
    tools are synthesized from settings. **Explicit tool libraries** — catalogs of real tools — will
    join as a second kind. A library without a known `kind` is a `400`.
  - An implicit library enables **tool families** and gives each family its own settings for
    **inch-sized tools** and for **metric** ones, in millimetres. Enabling both systems for a family
    synthesizes both, so one library can say "inch endmills, but drills in both systems". Any
    setting left out is tp-kernel's default. The families and their settings:

    | Family           | Systems      | Settings                                              |
    | ---------------- | ------------ | ----------------------------------------------------- |
    | `faceMill`       | inch, metric | `diameter` — the one face mill made                   |
    | `flatEndmill`    | inch, metric | `minDiameter`, `maxDiameter`, `maxLengthOverDiameter` |
    | `bullNose`       | inch, metric | `minDiameter`, `maxDiameter`, `maxLengthOverDiameter` |
    | `ballEndmill`    | inch, metric | `minDiameter`, `maxDiameter`, `maxLengthOverDiameter` |
    | `drill`          | inch, metric | `minDiameter`, `maxDiameter`, `maxLengthOverDiameter` |
    | `chamfer`        | inch, metric | `minDiameter`, `maxDiameter`, `maxLengthOverDiameter` |
    | `keyseat`        | inch, metric | `minDiameter`, `maxDiameter`, `maxLengthOverDiameter` |
    | `tap`            | inch, metric | `minDiameter`, `maxDiameter`                          |
    | `cornerRounding` | inch, metric | `minDiameter`, `maxDiameter`                          |

    Beside its families, a library may carry an optional `name` (up to 100 characters), a label only.
    Only settings tp-kernel acts on are accepted; any other field is a `400`. Further settings —
    diameter and radius increments, a bull nose's corner radius, chamfer angles, keyseat thickness
    and width of cut, a stocked tap-size chart — join their families as the kernel takes them. No
    family makes dovetail cutters.

  - Omitted, `toolCrib` is one implicit library with every family inch-sized at the kernel's
    defaults, and corner rounders off. An implicit library must enable at
    least one family, an enabled family at least one system it comes in, and each diameter range its
    minimum no greater than its maximum; otherwise the request is a `400`.
  - The ack (202) echoes the `toolCrib` the job was planned with.
  - **Calculate a plan’s toolpaths** keeps the plan's own tool crib unless the body names a new one,
    which replaces it whole. An Idempotency-Key reused with a different crib is refused as
    `idempotency_key_reused`.

  The same routes also accept an optional `machine`: the machine the part is quoted on.
  - `machine` is `{ name?, maxRpm?, toolChangeSeconds? }` — a label, the spindle's top speed in whole
    rev/min, and how long a tool change takes in seconds. Any other field, a fractional or
    non-positive `maxRpm`, or a negative `toolChangeSeconds` is a `400`.
  - **The machine is recorded, not yet applied.** It is stored with the plan and echoed in the ack
    (plan reads do not return it, nor the tool crib), but tools,
    setups and machining times are computed exactly as without it until tp-kernel accepts a spindle
    ceiling. Machining times never include tool changes; `toolChangeSeconds` is there for the caller
    to price them.
  - The ack (202) echoes `machine`, or `null` when the request named none. **Calculate a plan’s
    toolpaths** keeps the plan's own machine unless the body names a new one, and an Idempotency-Key
    reused with a different machine is refused as `idempotency_key_reused`.

  The body of these three routes is now strict: a field other than `material`, `toolCrib` and
  `machine` is a `400` rather than ignored, so a setting the API does not take cannot look applied.

  No existing field changes shape, type or requiredness; `toolCrib` and `machine` are optional on
  every route that takes them, and always present in the ack. **Default planning does change:** a
  request that names no tool crib now plans with the default crib — no corner rounders, and no
  dovetail cutters, since no family makes them — so a part that relied on either can come back with
  features unmachinable.

  ### Engine API 1.15.1

  Feature datasheets follow tp-kernel 0.15.0: one field is new, one is deprecated, and plans move
  with the kernel.
  - **Part features** (`GET /v1/parts/{id}/features`) carry a new optional `isEdgeBreak` on the
    `Three` facts, and on a chamfer's `three`: whether the surface is an edge break — a chamfer,
    slanted face or quarter-round outer fillet no taller than a quarter inch, at least twice as long
    as wide, on a convex edge. It is what tool matching now reads, and it is absent on a feature
    enriched before this release.
  - A chamfer's `bevel.isOpenPocketBottom` is **deprecated**: the kernel no longer computes it. A
    feature enriched from now on reads `false`; one enriched earlier keeps the value it stored. The
    field stays present and required until the next API major removes it.
  - Plans (`POST /v1/parts/{id}/plans`, `/toolpaths`) are made by tp-kernel 0.15.0: synthesized
    endmills are no wider than 3/4" by default, compatible roughs fold into one pass and trailing
    passes batch by tool so a job changes tools less often, and a finishing pass whose holder would
    meet remaining material is refused (`refusedReason`) rather than cut. Synthesized tools carry
    short names such as `FlatSynth` in `tool.name`.
  - A feature tag (`featureTag`, `featureTags`) and a region index are stable across runs of one
    kernel version, not across versions: a plan's tags name the features of its own `kernelVersion`.

  This release is additive. No existing field changes shape, type or requiredness; the new field is
  optional, and the deprecated one is still served on every feature.

  ### Engine API 1.15.0

  A quote can now name the material it is for, so tools are synthesized and machining times calculated
  against it rather than always against aluminium.
  - **Create a plan** (`POST /v1/parts/{id}/plans`), **Calculate toolpaths**
    (`POST /v1/parts/{id}/toolpaths`) and **Calculate a plan’s toolpaths**
    (`POST /v1/plans/{planId}/toolpaths`) accept an optional JSON body `{ "material": … }`. The material
    is one of `Aluminum`, `LowCarbonSteel` or `StainlessSteel` — the feeds-and-speeds charts tp-kernel
    synthesizes tools from — and steel plans slower than aluminium, so a part's machining times and the
    quote off them move with it.
  - The body is optional and the field defaults to `Aluminum`: a bare POST plans exactly as it did
    before, so nothing that does not send a material changes. The ack (202) echoes the `material` the
    job was planned for, and the plan reads — `GET /v1/plans/{planId}`, `/machining-time`, `/toolpaths`
    and the `GET /v1/parts/{id}/plans` summaries — now carry it too, beside `kernelVersion`. Plans made
    before this are reported as `Aluminum`, which is what they were.
  - **Calculate a plan’s toolpaths** without a body recomputes in the plan’s own material rather than
    defaulting to aluminium, so a stainless plan stays stainless.

  This release is additive. No existing field changes shape, type or requiredness; the new request body
  is optional on every route that takes it, and the new `material` response field is always present
  (`Aluminum` for older plans).

  ### Engine API 1.14.0

  A plan now says what each action runs at — the feeds and speeds behind its machining time — and a
  little more about the tool that cuts it.
  - Every per-action view — `GET /v1/plans/{planId}`, `/machining-time` and `/toolpaths` — gains
    `feedSpeed`: the `spindleSpeed` (rev/min) and `cuttingFeedRate` (mm/min) the pass runs at, plus its
    `stepdown` and `stepover` (mm) where the pass sets them. It is resolved from the pass itself, so it
    is present on a plan that is only `planned`, before any toolpath is cut.
  - `feedSpeed` is `null` in two cases the plan's `kernelVersion` tells apart: the action's tool has no
    feeds for the pass, or the plan was computed before this release and carries none at all. For the
    second, plan the part again — `POST /v1/parts/{id}/plan` or `POST /v1/parts/{id}/toolpaths` — on
    tp-kernel 0.14.0, which resolves it off the pass.
  - The synthesized `tool` on each action gains `stickout` (how far the tool reaches below its holder,
    mm) and `fluteCount`. For a milling or drilling pass, chip load is
    `cuttingFeedRate / (spindleSpeed × fluteCount)` and surface speed is
    `π × diameter × spindleSpeed / 1000`, in m/min; a tap is the exception — its feed is one thread
    pitch per revolution, not a chip per flute.
  - A plan's coverage shortfall (`issues[].kind`) gains `OutOfPlay`: regions some direction reaches but
    no feature in play holds — a feature the kernel rejected or excluded. `Unseen` now means only
    regions no direction reaches at all.

  This release is additive. No existing field changes shape, type or requiredness; `OutOfPlay` widens an
  existing enum, so a reader that switches over `issues[].kind` should carry a default for it.

  ### Engine API 1.13.0

  A plan now says what block the job starts from, so a quote can be written against the material that
  was bought rather than against the part that comes out of it.
  - `GET /v1/plans/{planId}/machining-time` gains `stock`: the initial stock as a block — two
    opposite corners in the first setup's frame, in mm, plus the frame itself. The block measures
    `upper - lower` on each axis, and the frame places it on the part. It is what tp-kernel 0.12.0
    sized around the part and squared up in the direction the job cuts first.
  - Stock is the figure a material charge is priced from. Metal is sold by weight, and a block is the
    thing that weighs something; the part's own bounding box is not a substitute, being the part
    rather than the stock squared around it.
  - The field is null for a plan calculated before this release — plan the part again, with
    `POST /v1/parts/{id}/plan` or `POST /v1/parts/{id}/toolpaths`, to get one — and for a part with
    no setup, which has nothing to square stock against.

  This release is additive. No existing field changes shape, type or requiredness.

## 0.6.0

### Minor Changes

- 9240b4d: Regenerate the TypeScript SDK for Engine API 1.12.1.

  This release moves the Engine API from tp-kernel 0.11.1 to 0.12.0. No schema changed shape: no
  field was added, removed, renamed, or changed type or requiredness. What changes is the
  documentation on one datasheet field, and the figures the kernel computes behind several others.

  `FeatureDatasheet.extendedZMax` is documented for what it is rather than how it was derived: the
  top of the band a pass over the feature runs down, which is not the feature's own `zMax` wherever
  a bevel sits on the mouth.
  - It sits above `zMax` where a chamfer, fillet **or countersink** sits on the feature's mouth —
    the countersink case is new in tp-kernel 0.12.0. It is the reach a tool is held to and the top
    of the band the time estimates price, which the previous description did not say.
  - The field keeps its name, type and requiredness. Its **value** moves for a feature bevelled on
    its mouth; a feature without one reads the same as before.
  - Parts enriched before this release keep the datasheets they were stored with and are not
    re-enriched, so a stored reading and a freshly computed one can differ for the same part.
  - `extendedZMin` is unchanged by this release; it moved in 1.12.0.

  Plan and toolpath figures move with it. `machiningTime`, `cuttingLength` and `pathLength` on plan,
  toolpath and machining-time actions are computed per run rather than fixed by the contract, and
  tp-kernel 0.12.0 changes what they come to:
  - A pass over a feature bevelled on its mouth starts at the top of that bevel, so it prices a
    deeper band. In a setup with no whole-part rough, stock inside the outline under the bevel is
    roughed and wall-finished with the feature instead of being plunged through, and the bevel pass
    then meets only its bevel.
  - Blind holes without a bottom cone reject drills whose points exceed their depth, and synthesis
    prefers milling below twice the drill-point height; through holes still allow breakthrough. A
    re-run of an unchanged part can therefore return a different tool per action and a different
    number of actions.
  - Toolpath geometry payloads split a segment wherever the programmed feed or rapid mode changes,
    so an unchanged path can arrive as more segments than before. Segment ranges still tile the
    point buffer, with a repeated junction point at each split.

  Existing plans, toolpaths and datasheets are left as they were computed; re-running a part through
  the pipeline is what picks these up.

## 0.5.0

### Minor Changes

- 26f0d90: Regenerate the TypeScript SDK for Engine API 1.8.0 (from 1.3.3).

  Display fast path: a part can be tessellated for a viewer without being analyzed.
  - `parts.createPartMesh` (`POST /v1/parts/{id}/mesh`) queues the tessellation and answers `202`
    with a job id; it honours `Idempotency-Key` like the other triggers.
  - `parts.getPartMesh` (`GET /v1/parts/{id}/mesh`) returns a `PartMeshResponse`: a 15-minute URL
    for the binary glTF (GLB), its point and triangle counts, and the job that produced it. Each run
    replaces the previous mesh; pass `jobId` to insist on a specific run. A part with no display mesh
    yet is `404 mesh_not_found`. This mesh is faceted from the uploaded file as-is, so it is not the
    analysis mesh `parts.getPart` describes: its counts differ and region triangle ranges do not
    apply to it.

  Quoting pipeline (Engine API 1.4–1.6): plans are addressable resources under a part.
  - `parts.createPlan`, `parts.listPlans`, and `parts.createToolpaths` live on the existing `parts`
    namespace. `plans.getPlan`, `plans.getToolpaths`, `plans.getMachiningTime`, and
    `plans.recalculateToolpaths` live on a new `plans` namespace of `createToolpathClient`.
  - `plans.getToolpaths` and `plans.getMachiningTime` answer `409` with a `PipelineReadinessProblem`
    — a problem document that also names the plan's current level — while the plan is not yet
    toolpathed.
  - New components: `PartMeshJobResponse`, `PartMeshResponse`, `QueuePartJobResponse`, `PlanSummary`, `PlanListResponse`, `PlanResponse`,
    `PlanSetup`, `PlanAction`, `PlanIssue`, `ToolpathsResponse`, `ToolpathSetup`, `ToolpathAction`,
    `MachiningTimeResponse`, `MachiningTimeSetup`, `MachiningTimeAction`, and
    `PipelineReadinessProblem`.

  Jobs and keys (Engine API 1.7):
  - `JobDetail` gains `updatedAt` and `durationMs`.
  - Every operation now states what it is billed as, and `403` is documented on every authenticated
    operation: a key with no access to the operation's area is refused with `product_mismatch`, and
    a key granted read access only is refused on a write with `read_only_key`.
  - `FaceFacts.needsSidemill` is deprecated (tp-kernel 0.11.0 no longer states it separately; read
    `!isFacing`). It stays on the type until the next API major.

  **Removed fields — a consumer that reads them will not compile.** `PartResponse` loses
  `downloadMs`, `recognitionMs`, `enrichmentMs`, and `totalMs`; `HolderResponse` loses `downloadMs`,
  `importMs`, and `totalMs`. Read a run's duration from `jobs.getJob(...).durationMs` instead. No
  other existing field changed name, type, or requiredness.

- 4b91da2: Regenerate the TypeScript SDK for Engine API 1.10.0.

  Reference documentation is reorganized around the part pipeline, the billing annotation is split
  into product and metered, and machining plans and toolpath calculation are marked as early access.
  - **Product and metered are now separate.** Each operation declares its product area in
    `x-toolpath-product` (`core`, `dfm`, or `quoting`) and whether the call is billed in
    `x-toolpath-metered` (boolean). This replaces the single `x-toolpath-billing` field, whose
    `unmetered` value conflated "free" with "core area". Every operation now has a product; only the
    compute calls are metered.
  - **Plan and toolpath reads move into their product (access change).** Reading a plan or its
    toolpaths/machining time now belongs to the `dfm`/`quoting` product rather than the free core
    area, so it requires that product's read grant. A key with only core access that previously read
    these will now receive `403 product_mismatch`; grant it DFM/Quoting read in the Portal. Nothing
    is newly billed — these reads remain free.
  - Operations are grouped and ordered by pipeline stage: `Parts` (upload, tessellate, and analyze),
    `Features`, `Plans`, `Toolpaths`, then `Tool holders` and `Jobs`, queue endpoints before reads.
    This is documentation grouping only; paths, request and response shapes, operation ids, and (apart
    from the read-access change above) key access are unchanged.
  - Operation summaries were standardized to a `verb + resource` form (for example
    `Queue part processing` → `Analyze a part`, `Create a plan and calculate its toolpaths` →
    `Calculate toolpaths`). `POST /v1/plans/{planId}/toolpaths` is renamed from "Recalculate
    toolpaths" to "Calculate a plan's toolpaths" (operation id unchanged). Every read states which
    pipeline step must run first to produce its data.
  - The plan and toolpath operations carry an `x-toolpath-experimental` extension and an early-access
    notice; they are available now but still gaining functionality, and breaking changes continue to
    follow the API major version.

  Apart from the plan/toolpath read-access change noted above, this release is additive: no existing
  response changes shape, and no key is newly billed.

## 0.4.1

### Patch Changes

- 60ceb60: Regenerate the TypeScript SDK for Engine API 1.3.2.

  Neither upload endpoint was ever limited to STEP, and the `filename` query parameter on
  `POST /v1/parts` and `POST /v1/holders` now says so: its description names the extensions they
  take.
  - Both endpoints accept the same formats — STEP (`.step`, `.stp`), Parasolid (`.x_t`, `.x_b`),
    SolidWorks (`.sldprt`), CATIA V5 (`.catpart`), NX/Creo (`.prt`), and IGES (`.igs`, `.iges`).
  - `filename` is what selects the reader — nothing inspects the bytes you upload — so its
    extension must match the file you send. **It is optional, and omitting it stores the upload as
    STEP**, which fails processing for any other format.

  This release is documentation only. No endpoint, schema or response changes shape, and no
  upload that worked before behaves differently.

- 59ab7f7: Regenerate the TypeScript SDK for Engine API 1.3.3.

  `FeatureDatasheet` gains `pinchPoints`, from tp-kernel 0.7.3: the places a feature is at its
  tightest, one disc per stretch of it that reaches the minimum clearance `cd` reports.
  - Each entry is a `PinchPoint` — a `center` (`Vec2`, across the part rather than along the tool)
    and a `diameter`, which is the clearance there. A cylinder of that diameter standing at that
    center and spanning the datasheet's `zMin`..`zMax` is the widest tool that reaches the feature
    boundary at that spot, so the discs can be drawn directly onto a plan view.
  - The list is ordered tightest first and capped at ten. It is empty for feature kinds whose
    clearance is not measured off a single medial axis — holes, facing passes, and the undercut and
    layered kinds — so empty means "nowhere to point at", never "nowhere is tight".
  - **The field is documented optional and may be absent.** Only features enriched by this release
    onward carry it; parts processed earlier keep the datasheets they were stored with and are not
    re-enriched. Treat a missing `pinchPoints` the same as an empty one only if that suits you —
    the two are not equivalent, since absent means unmeasured rather than unmeasurable.

  `PinchPoint` and `Vec2` are new components. Everything else on the datasheet is unchanged, and no
  existing field changed name, type, or requiredness.

## 0.4.0

### Minor Changes

- 3a92bc7: Regenerate the TypeScript SDK for Engine API 1.2.0.
- b9cdb0e: Regenerate the TypeScript SDK for Engine API 1.3.0.

  Tool holder import: upload a holder's CAD file, derive its collision envelope, and export it as an
  Autodesk Fusion tool library.
  - Five new endpoints — `POST /v1/holders`, `PATCH /v1/holders/{id}`, `GET /v1/holders/{id}`,
    `GET /v1/holders/{id}/fusion`, and `GET /v1/holder-libraries/fusion`.
  - A job can now name a holder as well as a part, so `holderUuid` and `importId` join `partUuid` and
    `reportId` on job responses, and `GET /v1/jobs` gains a `holderId` filter beside `partId`.
  - `PATCH /v1/parts/{id}` now answers `409 idempotency_key_reused` when an `Idempotency-Key` was
    already spent on a different part or a different product. Retrying the same request still replays
    the original job; what changed is that reusing a key across operations no longer returns a job id
    belonging to something else.

  This release is additive. No existing response changes shape: a job that names a part still carries
  its `partUuid` and `reportId`, and a client that never creates a holder never receives a holder job.
  `partUuid` is declared nullable so one schema can describe either subject, which widens the
  generated SDK's type to `string | null` — TypeScript consumers that dereference it will want a null
  check, or can read the new `holderUuid` to tell the two subjects apart.

### Patch Changes

- a90e28e: Regenerate the TypeScript SDK for Engine API 1.3.1.

  Part results now carry `turnability`: whether the part belongs on a lathe, read from the imported
  part on every analyze run.
  - `GET /v1/parts/{id}` gains a `turnability` field — either a `TurningAxis` (the axis's `direction`
    and `location`, the `areaFraction` of the surface one turning setup could finish, and the
    `volumeFraction` of the envelope of revolution the part keeps), or `NoAxis` when the kernel found
    no axis worth turning about, or `null` when no reading was taken.
  - `null` and `NoAxis` are different answers. `NoAxis` is a result; `null` means the reading is
    absent — every part result produced before this release, and any run where the reading failed.
  - The field does not depend on `featureDetails`. Unlike `directionZBounds`, it is populated on runs
    that skip feature enrichment.

  This release is additive. No existing response changes shape.

## 0.3.0

### Minor Changes

- 56499f3: Regenerate the TypeScript SDK for Engine API 1.1.0.

## 0.2.5

### Patch Changes

- 26c00ca: Regenerate the TypeScript SDK for Engine API 1.0.4.

## 0.2.4

### Patch Changes

- 2dc3546: Update published package repository links after the repository rename.

## 0.2.3

### Patch Changes

- 584e061: Regenerate the TypeScript SDK for Engine API 1.0.3.

## 0.2.2

### Patch Changes

- 1b75dd9: Regenerate the TypeScript SDK for Engine API 1.0.2.

## 0.2.1

### Patch Changes

- 1927f4e: Regenerate the TypeScript SDK for Engine API 1.0.1.

## 0.2.0

### Minor Changes

- 4fe5c56: Expose Engine API region split origins in generated TypeScript types.
