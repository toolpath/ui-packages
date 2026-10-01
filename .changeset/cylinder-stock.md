---
'@toolpath/viewer': minor
---

Add `CylinderStock` for round stock along any axis, `fixedCylinderStock` for a fixed-cylinder preview placed by the same position rule as fixed-box stock, and `OrientedBoxStock` for a block squared to a frame of its own, such as a plan's setup-squared stock box. `Stock` now accepts either caller-owned `geometry` or initial/in-process stock GLB bytes through `glb`, without fetching or caching artifacts. Stock outlines are now built only when shown.
