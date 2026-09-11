---
'@toolpath/tool-drawing': minor
---

Add `<ToolDrawing zoom>`, a zoom to the working end. `zoom="tool"` frames the
length of tool below the holder — the stickout the assembly was drawn at, or the
tool's own `LBH` where no holder is drawn — plus 15% of it again of holder above
the cut, and measures the sheet's width below that cut rather than over the
whole stack. The holder above the cut is drawn and cut by the edge of the sheet
rather than trimmed to a face nobody published; a dimension measuring past the
cut is dropped. `extentFor` is the same decision as a pure function, from the
root and from `/geometry`, and `dimensionsWithin` is the dimension model's half
of it. `DrawingContext` now also carries `extent`, what the sheet was framed to,
beside `outline`, what was drawn.
