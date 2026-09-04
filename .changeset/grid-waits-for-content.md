---
'@toolpath/viewer': patch
---

`Grid` draws nothing until the scene has been measured. It is sized from `useContentBox`, which is
empty on the first frame, and a grid built from an empty box sits on a plane at infinity — three.js
logged `Computed radius is NaN` on every mount.
