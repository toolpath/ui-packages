---
'@toolpath/tool-support': minor
---

Derive a Fusion holder's `gaugeLength` from the shape that was exported, on the published arm as
well as the measured one.

Autodesk defines the holder's gauge length as the height _below the gauge line_, so it is a
reading of the segment stack rather than a fact standing beside it. The measured arm already
worked that way — `belowGageLine` makes the cut and the last vertex is the answer — but a
published holder was written with the vendor's own figure against a stack built from the vendor's
dimensions, and on a V-flange holder those are two different lengths. REGO-FIX publishes `B4`,
nose to gauge line, beside `B3`, nose to the flange face, and `B4 - B3` is 48.4 mm on every BT 30:
the gauge-line-to-flange distance from the vendor's own standards table. `B3` is what
`fromPublished` can draw, because no vendor publishes the shape of the flange above it. So a
BT 30 collet chuck went out declared 98.4 mm below the gauge line and drawn 50 mm long, and
`assemblyGaugeLength` — the stickout plus the holder's gauge length — put the tool 48.4 mm from
the gauge line it was drawn against.

The stack's own height is now the exported figure, and the vendor's is reported instead: a
`dropped` note on `holder.gaugeLength` naming both numbers where they disagree. Where a vendor
publishes no gauge length the holder no longer goes out without the key — its shape is fully
drawn and its height therefore known — and a `filled` note says the number was read off the
geometry. A `nose`-datumed profile still omits `gaugeLength` entirely, because its silhouette is
the whole holder rather than the part below the gauge line.

Both fixtures that covered this published a `projection` and a `gaugeLength` that were equal, so
no test could tell the two readings apart. One that does is added.
