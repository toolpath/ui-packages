---
'@toolpath/viewer': minor
---

Add `ExplodedPart` and its primitive input and picking types. Applications supply
surface groups, stable IDs, translation vectors, colors, and explosion amount;
the viewer renders and picks those groups without choosing features or machining
directions. Includes batched rendering, source highlights, shader preparation, and
buffer reuse across visibility and theme changes. Accepts `ViewerTheme` overrides
for source geometry, outlines, and selection/hover tints. Prepares each piece from
surface geometry directly, without copying feature models. Grouping rules, animation controls, and
application metadata remain with the consumer.
