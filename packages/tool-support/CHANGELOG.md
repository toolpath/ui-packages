# @toolpath/tool-support

## 0.4.0

### Minor Changes

- 2d2ac37: Add two entry points for writing this domain out into a CAM system's own format.

  `@toolpath/tool-support/export` holds what every exporter shares. `CatalogTool` extends `Tool`
  with the identity and commerce half the domain deliberately omits — a guid, a vendor, a catalog
  number, the substrate and the unit system the vendor published in. Every field is spelled as
  `@toolpath/tool-scraper`'s `ToolRecord` spells it, so a scraped record is an input with no
  adapter. It takes `threadMethod` in either spelling the tree uses, because `Tool` writes an
  unclassified tap's method as absent and a `ToolRecord` writes it as `null`. `ExportNote` and `ExportResult` are how an exporter reports what it could not
  carry across: a record skipped, a fact the format has no word for, a value the exporter supplied,
  or one coerced to something weaker.

  `@toolpath/tool-support/export/fusion` writes an Autodesk Fusion tool library. `fusionLibrary`
  takes tools, their holders and their stickouts and returns the document plus the notes;
  `fusionLibraryJson` writes it out, and `sanitizeName` gives a name Fusion will take. Bare tools
  and tools with holders both work, and a holder is written from either arm of the `Holder |
HolderProfile` union — a measured profile is cut at its own gage line by `belowGageLine` rather
  than by inferring a taper.

  All 24 `TOOL_FORMS` values are valid Fusion tool types, so a tool exported there lands on the
  type it already has, and `'other'` is refused rather than rounded to the nearest. Fusion's `LB`
  is this package's `LBH` and an assembly's `stickout`, and `assemblyGaugeLength` is that plus the
  holder's gauge length.

  By default the exporter supplies what Fusion requires and a vendor did not publish, so a bare
  scraped tool loads: conventions such as hand and thread starts, and readings of the tool's own
  dimensions such as the stickout from `setupStickout`. It never supplies a measurement — a tool
  with no stated cutting diameter, or a bull nose with no stated corner radius, is skipped with a
  note. `fill: 'none'` supplies nothing.

  Cutting-data presets are carried, not computed: a caller passes `presets` on a tool and the
  exporter checks them against the type. Autodesk states a preset's shape per tool type and the
  five shapes differ sharply — a milling preset requires seventeen fields, a tap's requires six and
  models nine, and a spot drill requires five feedrates a drill does not model — so a preset short
  of its type's requirements is dropped with a note naming every missing field, and a field the
  type does not model is dropped with its own. The tool still exports; `presets: []` is legal.
  Presets are not unit-converted and must arrive in the tool's own unit system.

  `FUSION_TYPES` and `fusionType` expose what the schema requires of each type — geometry and
  presets both — alongside the format's unit, material, coolant and segment vocabularies, its guid
  pattern and its library version.

  Nothing here writes a file and nothing mints a guid: Fusion requires one on every entry, and one
  invented at export time would make each re-export look to Fusion like a new tool.

  Both entry points are additive. The root entry is unchanged, and the package still declares no
  runtime or peer dependency.

## 0.3.1

### Patch Changes

- a8540d8: Grip a shank at the size the collet is named for.

  `gripsShank`'s tolerance was `1e-6` mm, sized for a conversion's last bit. A clamping
  band is not a computed measurement, though — it is a figure a vendor printed to three or
  four decimal places — so four of the 764 collets in the scraped catalog refused the
  shank they are sold for:
  - Kennametal `25ER0312`, a 5/16 in ER25, prints `CCCX` as `0.312` in and `7.938` mm in
    one row. 7.938 mm is 0.3125 in exactly, so the inch cell is that value at three places
    and the band stopped 0.0127 mm below a 5/16 shank.
  - `32ERSS0281`, `32ERSS0406` and `32ERSS0719` print the nominal and the band as the same
    four-decimal inch value rounded in opposite directions, and missed by 0.00254 mm.

  The tolerance is now one thousandth of an inch — the coarsest last place these catalogs
  print, so it is the width of the artifact rather than a figure picked to clear it. It
  sits 2x above the widest of those and 2.5x below the narrowest capacity a vendor
  undersizes on purpose, `40ERSS0312` at 0.0635 mm. All ten sealed ER40 rows of that shape
  stay refused. No collet that matched a shank before stops matching one.

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
