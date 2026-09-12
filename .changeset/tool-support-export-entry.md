---
'@toolpath/tool-support': minor
---

Add two entry points for writing this domain out into a CAM system's own format.

`@toolpath/tool-support/export` holds what every exporter shares. `CatalogTool` extends `Tool`
with the identity and commerce half the domain deliberately omits — a guid, a vendor, a catalog
number, the substrate and the unit system the vendor published in. Every field is spelled as
`@toolpath/tool-scraper`'s `ToolRecord` spells it, so a scraped record satisfies it structurally
with no adapter. `ExportNote` and `ExportResult` are how an exporter reports what it could not
carry across: a record skipped, a fact the format has no word for, a value the exporter supplied,
or one coerced to something weaker.

`@toolpath/tool-support/export/fusion` holds what Autodesk's tool-library schema requires of each
type — `FUSION_TYPES` and `fusionType`, alongside the format's unit, material and segment
vocabularies, its guid pattern and its library version. All 24 `TOOL_FORMS` values are valid
Fusion tool types, so a tool exported there lands on the type it already has.

Both entry points are additive. The root entry is unchanged, and the package still declares no
runtime or peer dependency.
