---
'@toolpath/api': minor
---

Regenerate the TypeScript SDK for Engine API 1.12.1.

This release moves the Engine API from tp-kernel 0.11.1 to 0.12.0. No schema changed shape: no
field was added, removed, renamed, or changed type or requiredness. What changes is the
documentation on one datasheet field, and the figures the kernel computes behind several others.

`FeatureDatasheet.extendedZMax` is documented for what it is rather than how it was derived: the
top of the band a pass over the feature runs down, which is not the feature's own `zMax` wherever
a bevel sits on the mouth.

- It sits above `zMax` where a chamfer, fillet **or countersink** sits on the feature's mouth —
  the countersink case is new in tp-kernel 0.12.0. It is the reach a tool is held to and the top
  of the band the time estimates price, which the previous description did not say.
- The field keeps its name, type and requiredness. Its **value** moves for a feature bevelled on
  its mouth; a feature without one reads the same as before.
- Parts enriched before this release keep the datasheets they were stored with and are not
  re-enriched, so a stored reading and a freshly computed one can differ for the same part.
- `extendedZMin` is unchanged by this release; it moved in 1.12.0.

Plan and toolpath figures move with it. `machiningTime`, `cuttingLength` and `pathLength` on plan,
toolpath and machining-time actions are computed per run rather than fixed by the contract, and
tp-kernel 0.12.0 changes what they come to:

- A pass over a feature bevelled on its mouth starts at the top of that bevel, so it prices a
  deeper band. In a setup with no whole-part rough, stock inside the outline under the bevel is
  roughed and wall-finished with the feature instead of being plunged through, and the bevel pass
  then meets only its bevel.
- Blind holes without a bottom cone reject drills whose points exceed their depth, and synthesis
  prefers milling below twice the drill-point height; through holes still allow breakthrough. A
  re-run of an unchanged part can therefore return a different tool per action and a different
  number of actions.
- Toolpath geometry payloads split a segment wherever the programmed feed or rapid mode changes,
  so an unchanged path can arrive as more segments than before. Segment ranges still tile the
  point buffer, with a repeated junction point at each split.

Existing plans, toolpaths and datasheets are left as they were computed; re-running a part through
the pipeline is what picks these up.
