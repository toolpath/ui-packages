---
'@toolpath/viewer': minor
---

Add `ExplodedPart` and its primitive input and picking types. Applications supply
surface groups, stable IDs, translation vectors, colors, and explosion amount;
the viewer renders and picks those groups without choosing features or machining
directions. Includes batched rendering, source highlights, shader preparation, and
buffer reuse across visibility and theme changes. Accepts `ViewerTheme` overrides
for source geometry, outlines, selection/hover tints, and the selected piece's source
surfaces (`picked`). Accepts `activeDirection` to rank picks for one machining direction, as
`PartMesh` does. Prepares each piece from
surface geometry directly, without copying feature models. Grouping rules, animation controls, and
application metadata remain with the consumer.

Accept multiple selected or hovered group IDs (`ExplodeGroupIds`) so applications can treat render chunks as one
logical piece, including its complete source highlight. Redraw after shader preparation when
layouts change in a demand-driven canvas.

Support per-region colors (`ExplodeRegionColors`) within each application-defined explosion group, preserving whole-piece
selection and picking without separate surface groups. Add `createExplodeAmount` for imperative
animation updates that automatically redraw demand-driven canvases while keeping playback
timing application-owned.
