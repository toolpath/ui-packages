---
'@toolpath/api': minor
---

`createToolpathClient` exposes every generated API. `toolpaths` (create and recalculate toolpaths,
read toolpaths and machining times), `toolHolders` and `demo` were generated but unreachable from
the client, so callers built those requests by hand.
