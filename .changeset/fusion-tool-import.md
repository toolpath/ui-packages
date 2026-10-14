---
'@toolpath/tool-support': minor
---

Add `@toolpath/tool-support/import/fusion`, which reads an Autodesk Fusion tool library (`{ version, data }` from `ToolLibrary.toJson()`) back into `Tool`s with every length in millimetres. `fromFusionTool` reads one entry and `fromFusionLibrary` a whole document, keeping each tool's guid and `data[]` index so the original record can be pushed back into Fusion. Holders are skipped; turning, laser, plasma, waterjet, electric arc wire, probe and tool block entries are skipped with a note; an unknown milling type is read as `'other'`; and a ball end mill's missing corner radius and a spot or center drill's zero diameter are supplied and reported as notes. Fusion's `HAND`, `CSP` and assigned `post-process.number` are carried as `hand`, `coolantThrough` and `number`.
