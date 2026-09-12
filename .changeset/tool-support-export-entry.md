---
'@toolpath/tool-support': minor
---

Add two entry points for writing this domain out into a CAM system's own format.

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
