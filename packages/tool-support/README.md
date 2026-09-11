# Toolpath Tool Support

`@toolpath/tool-support` is the cutting-tool domain: what a tool, a holder, a
collet and an assembly _are_, and the arithmetic that follows from them.

**It depends on nothing.** No runtime dependencies, no peer dependencies, no
React, no DOM, no `fs`, no Toolpath SDK. Every other package that speaks about
cutting tools depends on it and it depends on none of them, which is what lets a
Node ingest script, a server route and a React renderer share one answer instead
of deriving three.

```
                    @toolpath/tool-support        depends on nothing
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
| `TOOL_FORMS`, `ToolForm`, `MILLING_FORMS`, `isToolForm`                | What a tool is, in a CAM library's words                          |

Every length is in millimetres and every angle in degrees, whatever system the
vendor published in — that is what lets an inch tool and a metric tool compare.
`UnitSystem` is a fact _about the tool_, never the unit a stored value is in.

### The contracts

| Export                                             | What it is                                   |
| -------------------------------------------------- | -------------------------------------------- |
| `Tool`, `Geometry`                                 | A cutting tool, as the arithmetic needs one  |
| `Holder`, `HolderProfile`, `isHolderProfile`       | The holder union: published, or measured     |
| `Collet`, `Assembly`                               | What grips the shank, and the stack it makes |
| `PROFILES_VERSION`, `ProfilePoint`, `ProfileDatum` | The measured silhouette                      |
| `ReachCurve`, `FeatureDemand`                      | What a feature demands of a tool             |

### The arithmetic

| Export                                                                            | What it answers                                         |
| --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `stickoutRange`, `minStickout`, `setupStickout`, `stickoutCeiling`                | How far the tool stands out — **the one answer**        |
| `DEFAULT_STICKOUT_POLICY`, `HELD_SHARE`, `StickoutPolicy`, `StickoutLimit`        | The floor, the step and the share a shop keeps held     |
| `clampWanted`, `clampShortfall`, `heldDiameter`, `headLength`, `DEFAULT_CLAMPING` | What the clamping rule keeps in the holder              |
| `holderTakesTool`, `colletFitsHolder`, `gripsShank`, `maxStickout`, `holdBand`    | Whether this holder takes this tool                     |
| `gripRanges`, `gripsAnyShank`, `canHold`                                          | Whether a whole crib can hold it, as one set of spans   |
| `stickoutLimits`, `defaultStickout`                                               | The collet-shaped way into the range above              |
| `hasNeck`, `shankOf`, `heightAt`, `belowGageLine`                                 | The four that used to be written twice                  |
| `fitAgainst`, `fitTools`, `DRILLING_FORMS`                                        | Whether a cutter cuts a feature                         |
| `clearance`, `toolSilhouette`, `holderSilhouette`, `toolCollisions`               | Whether the stack clears the material around it         |
| `assemblyAgainst`, `NOT_MODELLED`                                                 | Whether there is a way to _hold_ it that reaches        |
| `sectionOutline`, `materialProfile`, `ASSEMBLY_PARTS`, `SILHOUETTE_PARTS`         | The feature in section, and what an assembly is made of |

## Two kinds of holder

A holder arrives in one of two forms, and they are **alternatives rather than a
refinement of one by the other**:

```ts
import { isHolderProfile, type Holder, type HolderProfile } from '@toolpath/tool-support'

const published: Holder = {
  noseDiameter: 27,
  noseLength: 12,
  bodyDiameter: 42,
  bodyLength: 20,
  projection: 60,
  flangeDiameter: 46,
  gaugeLength: 60,
  colletSeries: 'ER16',
  colletProtrusion: 2.5,
}

const measured: HolderProfile = {
  points: [
    [-30, 8],
    [0, 23],
    [48, 21],
    [60, 13.5],
  ],
  datum: 'gage-line',
  colletSeries: 'ER16',
  colletProtrusion: 2.5,
}

isHolderProfile(measured) // true — read `points`
isHolderProfile(published) // false — read the vendor's own numbers
```

`Holder` is a handful of numbers off a DIN 4000 sheet, and a drawing built from
them is a stylised holder. `HolderProfile` is the envelope measured off the
vendor's STEP model — a hundred-odd vertices carrying the V-flange groove and the
thread relief a machinist actually looks for. Reducing it to a nose and a body
throws away the only reason to measure, so the two are a union and
`isHolderProfile` tells them apart. A consumer with neither passes `null`.

## No classes, deliberately

Everything here is a readonly interface or a pure function over one. Two reasons
beyond consistency:

- **A class loses structural typing at a package boundary.** A catalog's own
  record simply _is_ a `Tool`, with no adapter — the adapter stays a choice
  rather than becoming a requirement.
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
import { stickoutRange } from '@toolpath/tool-support'

const range = stickoutRange(
  { unitSystem: 'inches', geometry: { DC: 25.4, OAL: 127, LCF: 31.75, SFDM: 25.4 } },
  { grip: 27.5 },
)
// range.setup      — what a machinist sets it up at. This is `geometry.LBH`.
// range.max        — the furthest it could ever stand out.
// range.limitedBy  — 'clamp' | 'hold' | 'collet': which cap decided, so a
//                    control can say why rather than showing a bare number.
```

Every other stickout is this call with more arguments, and `min ≤ setup ≤ max`
holds by construction — so a drawn stickout can never exceed the length a table
prints beside it. That invariant is a test, not a sentence in this file.

## Status

`0.x`: in use, and the surface still moves. A minor is the breaking channel
while the major is `0` — `^0.1.0` does not accept `0.2.0` — so nothing arrives
in a consumer's build without them asking for it.
