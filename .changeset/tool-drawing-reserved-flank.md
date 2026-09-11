---
'@toolpath/tool-drawing': minor
---

Fit the drawing before the room reserved beside it. `<ToolDrawing padding>` is
now a reservation granted out of the room the drawing cannot use, rather than a
margin the scale pays for, so a reservation sized for a wide sheet no longer
shrinks the assembly on a narrow one. An assembly with a holder — wide enough
that the across axis binds — is drawn more than twice the size it was in a
220 px-wide panel; a long thin tool is unchanged, and still hands the flank to
the clearance overlay's wall. `frameFor` takes the same thing as `reserve`, and
reports what it granted as `Frame.reserve`.
