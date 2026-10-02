---
'@toolpath/viewer': minor
---

Add optional `Stock` `retainPrevious` behavior to keep the current GLB visible until its replacement finishes decoding. Dispose replaced geometry after the swap, and discard cancelled decode results.
