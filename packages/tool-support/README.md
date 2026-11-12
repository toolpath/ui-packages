# Toolpath Tool Support

`@toolpath/tool-support` is the cutting-tool domain: what a tool, a holder, a
collet and an assembly _are_, and the arithmetic that follows from them.

**It depends on nothing but Zod.** `zod` is its one runtime dependency, in
which the shared tool record is stated; no other runtime or peer dependency, no
React, no DOM, no `fs`, no Toolpath SDK. Every other package that speaks about
cutting tools depends on it and it depends on none of them, which is what lets a
Node ingest script, a server route and a React renderer share one answer instead
of deriving three.

```
                    @toolpath/tool-support        depends on zod alone
                     ↑          ↑          ↑
    @toolpath/tool-scraper   @toolpath/tool-drawing   your application
```

## Install

```sh
npm install @toolpath/tool-support
```

## Why it exists

`@toolpath/tool-scraper` produces tool data and `@toolpath/tool-drawing`
consumes it, and every application in between re-derived what a tool assembly
is. The same fact ended up declared three times over: two names for one
millimetres-per-inch constant, three vocabularies for one unit axis, three
provenance types, two `PROFILES_VERSION`s — one of them imported under an alias
specifically so it could be compared against the other — and three shapes called
"holder" of which no two agreed on which fields exist.

That is not a tidiness complaint. **How far a tool stands out of its holder was
computed in four unconnected places and disagreed by a factor of two on an
ordinary tool.** A details table printed one number and the drawing beside it
drew another, so the dimension line ran past the holder nose and into the holder
body. It was fixed inside one application, which means the next consumer of the
same two packages reproduces it from scratch. That quantity is a pure function of
the tool, the collet and a shop's policy, and it had no home.

## What it holds

### The vocabulary

| Export                                                                 | What it is                                                        |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `UnitSystem`, `UNIT_SYSTEMS`, `MM_PER_INCH`                            | How a vendor publishes a family, and the one constant between two |
| `convertLength`, `decimalsFor`, `UNIT_ABBREVIATION`                    | Converting, rounding and spelling it                              |
| `Provenance`, `PROVENANCE`, `ProvenanceMap`                            | Where a stated number came from                                   |
| `GEOMETRY_FIELDS`, `geometryField`, `isLengthField`, `convertGeometry` | The ISO 13399 dictionary, and whether a code's value converts     |

Every length is in millimetres and every angle in degrees, whatever system the
vendor published in — that is what lets an inch tool and a metric tool compare.
`UnitSystem` is a fact _about the tool_, never the unit a stored value is in.

### The record

A tool, what holds it and how far it stands out, stated as Zod schemas with each
type inferred from its schema.

| Export                                              | What it is                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `Tool`, `InsertTool`, `CuttingTool`                 | A solid tool, an insert tool, and either: kind, diameter, flute length and the rest             |
| `Holder`, `Collet`, `Clamping`                      | What holds it: a cone stack, how it grips, and what clamps the shank                            |
| `Extension`                                         | A modular extension a cutting head screws onto: what the holder clamps                          |
| `RotatingToolAssembly`                              | The tool, holder, collet and any extension, the stickout and the shop's T number                |
| `ToolLibrary`                                       | A catalog's contents: its tools, holders, collets and extensions                                |
| `CLAMPINGS`, `COLLET_KINDS`, `SHANK_FORMS`          | How a holder grips, what a collet is, and a shank's form                                        |
| `ISO_MATERIAL_GROUPS`                               | The ISO 513 workpiece groups a tool is for                                                      |
| `Cone`, `Catalog`                                   | One layer of a revolved outline, and who makes something                                        |
| `ToolKind`, `TOOL_KINDS`, `KERNEL_TOOL_KINDS`       | What a tool is: the kernel's head kinds, then the kinds it does not plan with                   |
| `parametricHolder`, `measuredHolder`, `trimToGauge` | A holder's stack from a vendor's table or a measured profile, and its part below the gauge line |
| `dimensionsOf`                                      | A solid or insert tool's figures read alike                                                     |
| `shankOf`, `overallLengthOf`, `unclampableLength`   | A tool's shank, length and unclampable length, read off its `shaft` (`stack.ts`)                |
| `statedShank`, `statedOverallLength`                | The shank and length, or null where a reader assumed them (`provenance`)                        |
| `shaftParts`, `ShaftPart`                           | Each shaft layer as `neck` or `shank`, as the clearance sweep and the drawing label it          |
| `neckOf`, `hasNeck`, `reachNeckOf`                  | Its neck as clamping reads it (under the shank) and as the kernel's reach does (under the cut)  |
| `stackHeight`, `sliceAt`, `Neck`                    | A cone stack's height, and its part below a height: a shaft cut at its stickout                 |
| `EPSILON`, `sameDiameter`, `narrowerThan`           | The diameter comparisons the stack readings use                                                 |
| `extensionShank`, `extensionLength`                 | An extension's shank and length, read off its `layers`                                          |
| `toolFromSummary`, `assemblyFromSummary`            | The record of a tp-kernel `ToolSummary` (`KernelToolSummary`)                                   |
| `conesToProfile`, `profileToCones`                  | A cone stack as a `[z, r]` outline and back                                                     |
| `cuttingDiameter`                                   | The diameter a tool cuts at: a face mill's grown over its lead angle                            |
| `ReachCurve`, `FeatureDemand`                       | What a feature demands of a tool                                                                |

Each type has its schema beside it — `ToolSchema`, `HolderSchema`,
`RotatingToolAssemblySchema` and so on — whose `.describe()`s are the field
docs. Fields have names, not ISO 13399 codes; the exporters map them onto codes
at the edge. An insert tool's `body.diameter` is its nominal diameter (`DC`);
the diameter it cuts at is `cuttingDiameter` (`DCX`).

Every field past a tool's kind, name and head is optional, and absent is nobody
having said. Among them:

- A tool's `materialGroups` are the ISO 513 groups its maker says it cuts.
- A solid tool's `shankForm` is plain, Weldon or Whistle Notch, and decides which
  bore clampings grip it: a side lock a Weldon flat or a Whistle Notch, a milling
  chuck or a hydraulic chuck plain or Weldon, a shrink fit plain. Through a
  reduction sleeve the sleeve's rule holds instead: any form but a Whistle Notch.
- A drill's `drillDepth` is the deepest hole it drills, short of its flutes.
- A tool's `shaft` is its body above the flutes to the end of the tool, a cone
  stack tip end first, as a holder's `layers` are: a neck, a shoulder, a taper
  and the shank are its layers, and its top layer's top diameter is the shank a
  holder clamps. An insert tool states its arbor the same way. No scalar states
  any of it again: the shank, the overall length and the necks are read off it
  (`stack.ts`). Its two readings carry the only provenance keys that are not
  fields: `shank`, the top layer's top diameter, and `overallLength`, the flutes
  and the stack's height. `assumed` on either is a reader's guess there, and
  `statedShank` or `statedOverallLength` answers null for it: a Fusion entry
  with no `SFDM` is filled at `DC` (`shank`), one with no `OAL` ends at `LB`
  (`overallLength`), and a kernel tool's shaft assumes both. A guessed shank is
  not held (`clampedShank` answers null) and neither guess is exported or caps a
  stickout. An extension's shank and length are likewise its `layers'`, and one
  with empty `layers` states no shank and is not held.
- A thread mill's `thread.teeth`, `thread.pitchMin` (a single point's range is
  `pitchMin` to `pitch`) and `thread.tip` are its tooth count, range and tooth form.
- A tap's `thread.partialThreads` is its lead, and `thread.handedness` its hand,
  which the kernel reads; `hand` is the hand of cut.
- An insert's `canSideMill` says whether its inserts reach down to cut a wall.
- A holder's `clampLength` is the shank it grips itself, which caps a stickout as
  a collet's does; `boreDepth` is how deep a shank goes, `faceContact` whether it
  seats on the spindle face, and `coolantThrough` whether coolant runs through.
- A collet's `kind` is `standard`, `coolant-through`, `tap` or `sleeve`; a sleeve
  states its `outerDiameter` and fits a bore clamping bored to it.
- `catalog` carries `productLine` and `orderNumber`, the maker's order number
  where it differs from `productId`.

A modular tool (Kennametal DUO-LOCK and the like) is a cutting head screwed onto
an `Extension` sold as its own item, and the holder or collet clamps the
extension's shank, not the head's. An assembly states it as `extension`, and
`extensionProtrusion` is the extension's head face to the holder face: the head
stands out of the extension by `stickout − extensionProtrusion`, and `stickout`
is still the tool tip to the holder face. `holderTakesTool` and `canHold` take
the extension as a last argument and hold the head by its shank
(`clampedShank`). The extension's `layers` are its outline, head end first,
and `ToolLibrary.extensions` is optional, so a library from before they were
carried still parses.

Two necks are read off a shaft, because two questions are asked:

| Reading       | What it is                                                      | Who asks                                                |
| ------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| `neckOf`      | The stretch below the shank run that is narrower than the shank | Clamping: a collet must not close on it                 |
| `reachNeckOf` | The run above the flutes narrower than the cutting diameter     | The kernel's reach: what follows the cutter down a wall |

A relief wider than the cut and narrower than the shank is the first and not the
second. Clamping reads the stack down from its top: the **shank run** is the
topmost layers that are straight cylinders at the shank's diameter, and what a
collet cannot close on at all, `unclampableLength`, is everything below it, so a
neck and a shoulder wider than the shank both count; `minStickout` and
`headLength` stand the tool out past it. A tapered top layer is no shank run: a
taper is not a shank a collet or a bore clamps, so the whole shaft is
unclampable. `shaftParts` labels each layer below the run that is narrower than
the shank `neck`, and the rest `shank`, for the clearance sweep and the drawing
alike.

The record requires no identity, because a tool the kernel made has none. A
library that needs a stable key uses `guid`, else `vendor` with `orderNumber` or
`productId`.

Every enum is closed (`TOOL_KINDS`, `CLAMPINGS`, `COLLET_KINDS`, `SHANK_FORMS`,
`ISO_MATERIAL_GROUPS`, `PROVENANCE`, `UNIT_SYSTEMS`), and a release may add
values: a reader of a collection validates each record on its own and drops the
ones that fail, rather than failing the whole collection.

`@toolpath/tool-support/import/fusion` reads one from a Fusion tool library:
`readFusionEntry` and `readFusionLibrary`, the latter index-aligned with
`data[]`. It reads geometry the way the kernel's own importer does, with the
catalog fields an entry states (`guid`, `product-link`, its unit, `HAND`, `CSP`,
`BMC`), and never throws on library data: an entry it does not model reads as
`null`. A `spot drill` reads as a `SpotDrill`, a thread mill keeps its `NT`,
`TPN` and tip, and a tap its `partialThreadCount`, which the Fusion exporter
writes back rather than the conventions. A Fusion library has no extension item,
so the reader leaves `extension` absent and the exporters ignore it. An entry's
holder states no clamping, so it reads as a `bore` of the shank of the tool it
was published with (`clampedShank`), both marked `derived`, and takes that shank
and no other; where the tool states nothing above its flutes it states neither,
and takes none. The tool's `shaft` is the kernel's stack — the cone the flutes
stop short on, a shoulder, any `shaft.segments`, then shank (`SFDM`, else `DC`)
to `LB` — carried on to `OAL`; the stickout is the kernel's, the flutes and its
stack to `LB`; an `OAL` below `LB` reads as `LB`. A shoulder stated by its
length alone becomes shank at `SFDM` (else `DC`): usable reach, as plain as the
shank above it. So does a `shoulder-diameter` within 1 µm of it, snapped to it:
an inch shoulder of 0.37499 on a 0.375 shank is plain shank, not a neck. A
keyseat's or dovetail's `undercutReach` is measured against the stack below the
stickout, as the kernel measures it.

### The arithmetic

| Export                                                                                     | What it answers                                         |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `stickoutRange`, `minStickout`, `setupStickout`, `stickoutCeiling`                         | How far the tool stands out — **the one answer**        |
| `DEFAULT_STICKOUT_POLICY`, `HELD_SHARE`, `StickoutPolicy`, `StickoutLimit`                 | The floor, the step and the share a shop keeps held     |
| `clampWanted`, `clampShortfall`, `heldDiameter`, `headLength`, `DEFAULT_CLAMPING`          | What the clamping rule keeps in the holder              |
| `holderTakesTool`, `colletFitsHolder`, `gripsShank`, `maxStickout`, `holdBand`             | Whether this holder takes this tool                     |
| `gripRanges`, `gripsAnyShank`, `canHold`                                                   | Whether a whole crib can hold it, as one set of spans   |
| `stickoutLimits`, `defaultStickout`                                                        | The collet- or holder-shaped way into the range above   |
| `hasNeck`, `shankOf`, `heightAt`, `trimToGauge`                                            | The four that used to be written twice                  |
| `fitAgainst`, `fitTools`, `DRILLING_KINDS`                                                 | Whether a cutter cuts a feature                         |
| `clearance`, `toolSilhouette`, `holderSilhouette`, `extensionSilhouette`, `toolCollisions` | Whether the stack clears the material around it         |
| `assemblyAgainst`, `NOT_MODELLED`                                                          | Whether there is a way to _hold_ it that reaches        |
| `sectionOutline`, `materialProfile`, `ASSEMBLY_PARTS`, `SILHOUETTE_PARTS`                  | The feature in section, and what an assembly is made of |

## A holder's shape

A vendor publishes a holder in one of two ways — a handful of numbers off a DIN
4000 sheet, or a CAD model whose silhouette is measured — and both become the
one cone stack a `Holder` is, nose first:

```ts
import { measuredHolder, parametricHolder } from '@toolpath/tool-support'

const published = parametricHolder(
  {
    noseDiameter: 27,
    noseLength: 12,
    bodyDiameter: 42,
    bodyLength: 20,
    projection: 60,
    flangeDiameter: 46,
    gaugeLength: 80,
  },
  { clamping: 'collet', colletSeries: 'ER16', colletProtrusion: 2.5 },
)

const measured = measuredHolder({
  points: [
    [-30, 8],
    [0, 23],
    [48, 21],
    [60, 13.5],
  ],
  datum: 'gage-line',
})
```

A published holder is cylinders: the nose, the body, the last stated diameter
carried up to the flange face, and the flange up to the gauge line where that is
stated. A measured one keeps every vertex — the V-flange groove and the thread
relief a machinist actually looks for — and its taper above the spindle face,
which a drawing shades as the connection. A sweep and an exporter read the stack
below the gauge line, `trimToGauge(holder)`.

A clearance sweep reads an assembly's modular extension too, as `extension`:
its layers each at its widest from its head face, `stickout −
extensionProtrusion`, up to the holder face, where the rest is in the holder.
The tool's own shank is swept as before, so the wider of the two governs. An
extension that states no shape sweeps nothing, and neither does one with no
`extensionProtrusion`, since where it sits is not known. One that does counts
toward `requiredStickout`: its length is fixed and it moves with the holder
face, so holder, collet and extension clear as one block, and the shop meets
it with a longer head or a longer extension. That stickout is never less than
`extensionProtrusion` plus the flute length, since the head face cannot sit
below the top of the flutes.
`@toolpath/tool-drawing` draws the same section between the same two faces.
The tool above its flutes is swept from its `shaft` alone, cut at the holder
face (`sliceAt`), each layer at its widest, labelled `neck` or `shank` by
`shaftParts`, as the drawing labels it. A tool that states no shaft sweeps
nothing above its flutes.

## No classes, deliberately

Everything here is a readonly interface or a pure function over one. Two reasons
beyond consistency:

- **A class loses structural typing at a package boundary.** A catalog's own
  record that carries more than a `Tool` is still one, with no adapter — the
  adapter stays a choice rather than becoming a requirement.
- **`instanceof` breaks across duplicate installs.** This tree has been bitten by
  that once already, and `@toolpath/tool-scraper` carries a packaging test about
  it.

Where several quantities have to agree, one function answers them together
rather than one apiece: `stickoutRange` hands back the minimum, the setup length
and the ceiling in a single record, along with which of the three caps set it. A
caller cannot take one of those and forget the others, which is precisely how
the defect above happened — four callers each worked out the piece they wanted.

## An unrecognised code is not given a meaning

`geometryField` answers `null` and `isLengthField` answers `false` for a code the
dictionary has not pinned. Show it as the vendor's own and do not convert it: a
guessed unit is a wrong number that looks right, and a 118-degree drill point
converted as a length is a plausible-looking 2.36.

```ts
import { convertGeometry, geometryField } from '@toolpath/tool-support'

convertGeometry('DC', 6, 'millimeters', 'inches') // 0.2362…
convertGeometry('SIG', 118, 'millimeters', 'inches') // 118 — an angle does not convert
convertGeometry('WOC', 6, 'millimeters', 'inches') // 6 — unpinned, so not converted
geometryField('WOC') // null
```

## The stickout, which is why this exists

```ts
import { stickoutRange, type Tool } from '@toolpath/tool-support'

const tool: Tool = {
  type: 'solid',
  kind: 'FlatEndmill',
  name: '1 in end mill',
  unitSystem: 'inches',
  diameter: 25.4,
  fluteLength: 31.75,
  // The shank, from the top of the flutes to the end of the tool: 127 overall.
  shaft: [{ thickness: 95.25, bottomDiameter: 25.4, topDiameter: 25.4 }],
}
const range = stickoutRange(tool, { grip: 27.5 })
// range.setup      — what a machinist sets it up at: an assembly's stickout.
// range.max        — the furthest it could ever stand out.
// range.limitedBy  — 'clamp' | 'hold' | 'grip': which cap decided, so a
//                    control can say why rather than showing a bare number.
```

Every other stickout is this call with more arguments, and `min ≤ setup ≤ max`
holds by construction — so a drawn stickout can never exceed the length a table
prints beside it. That invariant is a test, not a sentence in this file.

## Exporting to a CAM system

`@toolpath/tool-support/export/fusion` writes an Autodesk Fusion tool library.
It is the first of several exporters, so what every exporter needs — the input's
identity half, and the account of what could not be carried across — lives in
`@toolpath/tool-support/export` and one subpath per format holds the rest.

```ts
import { fusionLibrary, fusionLibraryJson } from '@toolpath/tool-support/export/fusion'

const { document, notes } = fusionLibrary({
  tools: [{ tool, assembly: { stickout: 24, holder } }],
})
writeFileSync('shop.tools', fusionLibraryJson(document))
```

`tool` is a `CuttingTool` and `holder` a `Holder`. Each needs a `guid`, which
the exporter never mints, and is written in its `unitSystem` (millimetres where
it states none). Its kind becomes the format's type and its fields ISO 13399
codes in one table at the edge (`export`'s `CAM_TYPES` and `isoGeometry`).

`notes` is the half that matters on real data. A catalog always contains tools a
format cannot hold, so a batch is never refused for one bad record: the tool is
left out and the note says why. Each note is `skipped` (no record written),
`dropped` (a fact the format has no word for), `filled` (a value this package
supplied) or `coerced` (a stated value mapped to something weaker).

What it will and will not supply is the one rule worth knowing. Fusion requires
geometry a vendor does not always publish — a bare tool states neither how far
it stands out nor its assembly gauge length — so the default fills **conventions**
(a tool is right-handed, a thread mill has one tooth) and **readings of the tool's own
dimensions** (`LB` from `setupStickout`; a plain shank's shoulder is its shank).
It never invents a **measurement**: a bull nose with no stated corner radius is
skipped rather than exported as a flat end mill. `fill: 'none'` supplies nothing
and reports every gap.

The Fusion exporter writes the shaft as segments; the shoulder and shank scalars
are set so they add nothing on re-read, so `readFusionEntry` gives back the same
`shaft`, stickout and holder. Fusion's reader adds its scalars to its segments,
so the rest of a chamfer mill's or countersink's cutting cone, which it adds
back at the `LB` written, is stripped from the bottom of the stack by height;
`shoulder-length` is the flutes and that rest, so the shoulder has no height,
and a neck is carried in the segments; the segments are the stack up to `LB`, less
a top layer of shank that `SFDM` and `OAL` restate. Above `LB` Fusion carries
only that shank, so a shaft that is anything else there is cut at `LB`, with a
note. The Mastercam exporter states `SFDM`, `OAL` and the first relief as a
shoulder, read off the shaft; `SFDM` and `OAL` only where stated
(`statedShank`, `statedOverallLength`), and no shoulder for a relief stated by
its length alone or as wide as the shank.

### Feeds and speeds

Presets are **carried, not computed** — what a tool's feeds and speeds should be
is a machining model this package does not have. A caller passes them and the
exporter checks them against the type they are going on:

```ts
fusionLibrary({ tools: [{ tool, presets }] })
```

That check is worth more than it sounds, because **Autodesk states a preset's
shape per tool type and the five shapes are nothing like each other.** A milling
preset requires seventeen fields; a tap's requires six and models nine in total,
having no feedrate at all. A drill states a feed per revolution and no cutting
feedrate, while a spot drill — which applications commonly generate through the
same code as a drill — additionally requires five feedrates a drill does not
model. A preset short of what its type demands is dropped with a note naming
every missing field, and a field the type does not model is dropped with a note
of its own. The tool still exports either way: `presets: []` is legal, and a tool
with no feeds is more use than a tool that was left out.

**Presets are not unit-converted.** Which unit each field uses differs per field
— `v_c` is metres or feet per minute, `v_f` millimetres or inches per minute,
`f_z` a length per tooth — so they must arrive stated in the same unit system as
the tool. This is the one place in the exporter where a caller can be wrong and
nothing will notice.

The rules each type must satisfy are Autodesk's own published JSON Schema,
reduced into this package's `schemas/fusion/digest.json`. `pnpm
schema:fusion:check-upstream` asks Autodesk weekly whether it has moved, and a test
fails if the table this package reads drifts from it.

## Status

`0.x`: in use, and the surface still moves. A minor is the breaking channel
while the major is `0` — `^0.1.0` does not accept `0.2.0` — so nothing arrives
in a consumer's build without them asking for it.
