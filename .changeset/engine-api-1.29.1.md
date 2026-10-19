---
'@toolpath/api': minor
---

Regenerate the TypeScript SDK for Engine API 1.29.1.

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
