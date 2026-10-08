---
'@toolpath/api': minor
---

Regenerate the TypeScript SDK for Engine API 1.23.0.

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
