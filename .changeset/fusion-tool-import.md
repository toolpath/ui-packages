---
'@toolpath/tool-support': minor
---

Add `@toolpath/tool-support/import/fusion`, which reads an Autodesk Fusion tool library (`{ version, data }` from `ToolLibrary.toJson()`) back into `Tool`s with every length in millimetres. `fromFusionTool` reads one entry and `fromFusionLibrary` a whole document, keeping each tool's guid and `data[]` index so the original record can be pushed back into Fusion; holders are skipped, an unknown type is read as `'other'`, and a ball end mill's missing corner radius and a spot or center drill's zero diameter are supplied and reported as notes.
