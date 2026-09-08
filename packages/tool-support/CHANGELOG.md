# @toolpath/tool-support

## 0.3.0

### Minor Changes

- 0cdcbbe: Refuse anything but a tap in a square-drive collet.

  `Collet` gains an optional `squareSize`, and `holderTakesTool` reads it: a tap collet's bore
  carries a square, so a shank-diameter test alone would seat an end mill of that size in something
  that holds it by nothing. A collet that states no square is unchanged, and a tap in a plain round
  collet still fits. `holderTakesTool`'s tool argument now also accepts `form`, optionally.

  `TAP_FORMS` and `isTapForm` are exported alongside `MILLING_FORMS`.

## 0.2.0

### Minor Changes

- 15254fb: Record whether a tap cuts its thread or forms it.

  `Tool` takes an optional `threadMethod`, `'cutting' | 'forming'`, beside `form`
  rather than as new `TOOL_FORMS` values — the form vocabulary stays Fusion's, and
  Fusion has no form-tap type. `ToolRecord.threadMethod` carries the same value on
  a tap and `null` on every other kind; `toolRecord` refuses a tap without one and
  a non-tap with one.

  Every tap family now states it as a cited fact: Kennametal's three from its
  `newTapType` facet, EMUGE's `FG01` from the category it titles `Machine taps`.
  And EMUGE's cold-forming taps are scraped for the first time —
  `emuge_form_taps.csv`, category `FG02`, 1,432 parts — so `forming` is a value the
  catalog actually holds rather than one only the type admits.

## 0.1.0

### Minor Changes

- a4b5204: Take the clearance sweep, the feature section and the part vocabulary.
  - `clearance`, `toolSilhouette`, `holderSilhouette`, `toolCollisions`,
    `describeCollision`, and `Clearance`, `Collision`, `SweptAssembly`. The
    verdict has a dozen callers that never draw anything, so it could not live in
    the drawing package; the lines an overlay draws _from_ a verdict still do.
  - `sectionOutline`, `FLOOR_BAND`, `REACH`, and `Section`, `SectionKind`,
    `SectionPoint`, `FeatureSection`.
  - `materialProfile` and `OutlinePoint` — the one reading of a reach curve with
    two consumers that are not both drawings.
  - `assemblyAgainst`, `AssemblyFit` and `NOT_MODELLED`.

  **The part vocabulary is named once.** `ASSEMBLY_PARTS` is the eight parts a
  drawn or swept assembly is made of, and `SILHOUETTE_PARTS` is _derived_ from it
  as the six a sweep checks — everything but the cutting end, because the cutting
  end is what is cutting. Two spellings of those words stood before, one in a
  drawing and one in a sweep, and a part renamed in either would have gone on
  meaning the old thing in the other.

  `Silhouette` and `@toolpath/tool-drawing`'s `OutlineSegment` both survive, and
  that is deliberate: a sweep needs one radius from one height upward and a
  drawing needs a polyline. They are different shapes for different questions and
  neither projects onto the other. Only the naming was duplicated.

  `Margins` and `NO_MARGINS` move with the sweep that reads them.

  `SweptAssembly` takes the **parametric** holder rather than the holder union. A
  measured `HolderProfile` is a hundred-odd vertices and sweeping one is a
  function that does not exist yet; taking the union would let a caller hand over
  a profile and get a verdict computed from nothing.

- a4b5204: Write a stored value out: `convertArea`, `formatLength` and `formatArea` join
  `convertLength` and `decimalsFor`, so the rounding, the abbreviation and the
  squared unit are one answer rather than a per-application one.
- a4b5204: Retire the arithmetic that was written twice.

  Four functions had two copies each, in packages that could not import one
  another, and each copy carried a note saying it must agree with its twin. Only
  one of the four had a test comparing them, and nothing enforced the rest.

  `@toolpath/tool-support` now publishes all four:
  - **`hasNeck`** — whether the section between the flutes and the shank is a neck
    to draw and to sweep. One copy drew the picture and the other decided the
    verdict: _"If the rule ever changes, it changes in both places or the picture
    and the verdict disagree about the same tool."_
  - **`shankOf`** and **`Shank`** — whether the shank behind the flutes is reduced
    against the cut. A different question from `hasNeck`, and both are needed: a
    relief wider than the cut is a neck to draw and not a reduced shank.
  - **`heightAt`** — the tallest material within an offset of the cut. The
    clearance verdict and the drawn staircase both read it, and neither could
    depend on the other.
  - **`belowGageLine`** — the measured silhouette from the spindle face out, with
    the crossing interpolated rather than snapped to the nearest vertex.

  `@toolpath/tool-drawing` takes `hasNeck` and `heightAt` from there. `ReachCurve`
  is now the shared type — still declared structurally, so a curve off a report
  still satisfies it with no adapter and the overlay still pulls in no Toolpath
  schema. `heightAt`, `ReachCurve`, `wallFaceAt`, `Margins` and `NO_MARGINS` all
  stay exported from `/clearance` unchanged.

  `@toolpath/tool-scraper` takes `ProfileDatum` and `ProfilePoint` from there.
  `HolderProfile`, `ProfilesDocument` and `PROFILES_VERSION` do not move: a
  measurement record carries the gauge lengths and the taper class a scrape
  resolved, and its version tracks that document's shape rather than the shape of
  one silhouette.

  A new test in `@toolpath/tool-drawing` asserts the remaining half of the
  gage-line pair — that trimming a silhouette at the spindle face and splitting it
  there interpolate the same crossing. That was a note in both files and is now a
  check, in the only package that can see both sides.

- a4b5204: Take ownership of the stickout, the holding rules and the tool-to-feature fit.

  **The stickout is the reason this package exists.** How far a tool stands out of
  its holder was worked out in four unconnected places and they disagreed by a
  factor of two on an ordinary tool: a details table printed one number and the
  drawing beside it drew another, so the dimension line ran past the holder nose
  into the holder body. `stickoutRange` owns the quantity, and every other number
  is that same call with more arguments — `setupStickout` is `geometry.LBH`,
  `stickoutCeiling` is the ceiling a reach check asks for, and `min ≤ setup ≤ max`
  holds by construction.
  - `stickoutRange`, `minStickout`, `setupStickout`, `stickoutCeiling`, and
    `StickoutRange`, `StickoutRequest`, `StickoutPolicy`, `StickoutLimit`,
    `StickoutTool`, `HELD_SHARE`, `DEFAULT_STICKOUT_POLICY`. The three caps — a
    shop's clamping length, the hold share, and a collet's published grip — are
    compared in one place and the tightest wins and says its name. They used to be
    a ceiling each in a different file.
  - `clampWanted`, `clampShortfall`, `heldDiameter`, `headLength`, `ClampingRule`
    and `DEFAULT_CLAMPING`. Reads the manufacturer's own `LSCN` first and falls
    back to a multiple of the **shank** diameter, which is what the holder grips.
  - `colletFitsHolder`, `gripsShank`, `holderTakesTool`, `maxStickout`,
    `holdBand`, `stickoutLimits`, `defaultStickout`, `gripRanges`,
    `gripsAnyShank`, `canHold`, and `Clamping`, `GripRanges`, `HoldBand`.
  - `fitAgainst`, `fitTools`, `DRILLING_FORMS`, `FitFailure` and `ToolFit`.

  `Holder` gains `clamping`, `boreDiameter` and `taper`, all **optional**: a
  consumer that hands over nine numbers to get a drawing must not have to invent a
  clamping mode. Absent means nobody has said, and nobody-has-said refuses — a
  holder that does not state how it clamps takes no tool, offers no grip range and
  matches no taper.

  Two rules point opposite ways on purpose. `holderTakesTool` refuses a tool whose
  shank nobody stated, because the unchecked case is a cutter falling out of a
  spindle. `fitAgainst` passes a demand nobody stated, because what is not stated
  is not claimed.

  One deliberate refinement: which tools are bounded by a hole's bore rather than
  by what can helix down it is now stated over `ToolForm` as `DRILLING_FORMS`. The
  coarse vocabulary it replaces had one word, `drill`, for a drill, a centre drill
  and a spot drill, so a stated spot drill could not be recognised as going in
  bore-first. All four forms are in the set.

- a4b5204: A new package: the cutting-tool domain, shared by everything that speaks about
  cutting tools.

  `@toolpath/tool-support` takes no runtime dependencies and no peers, and imports
  no React, no DOM, no `fs` and no Toolpath SDK — so a Node ingest script, a server
  route and a React renderer can all depend on it. `tests/boundary.test.ts` asserts
  that from the package tree and the manifest rather than from a list.

  This first release is the vocabulary and the contracts:
  - `UnitSystem`, `UNIT_SYSTEMS`, `MM_PER_INCH`, `convertLength`, `decimalsFor` and
    `UNIT_ABBREVIATION`. One vocabulary for an axis that had three names and two
    copies of the conversion constant.
  - `Provenance`, `PROVENANCE` and `ProvenanceMap`, the one declaration of what had
    been three identical types.
  - `GEOMETRY_FIELDS` and its `geometryField`, `isLengthField` and `convertGeometry`
    readers. The dictionary carries each code's unit kind, which is what decides
    whether a stated number converts with a unit system; an unpinned code is not
    given a meaning and is not converted.
  - `TOOL_FORMS`, `ToolForm`, `MILLING_FORMS` and `isToolForm`.
  - `Tool`, `Geometry`, and the holder as a union of the published `Holder` and the
    measured `HolderProfile`, discriminated by `isHolderProfile`.
  - `Collet`, `Assembly`, `PROFILES_VERSION`, `ProfilePoint` and `ProfileDatum`.
  - `ReachCurve` and `FeatureDemand`, both declared structurally so no part schema
    travels with them.

  Nothing depends on it yet. That is deliberate: it is the last point at which the
  surface can change freely.
