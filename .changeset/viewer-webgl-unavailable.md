---
'@toolpath/viewer': minor
---

`<Viewer>` now shows an alert asking the user to turn on graphics acceleration when the browser
cannot create a WebGL context, instead of throwing and leaving a blank viewer. Replace the message
with the new `webglUnavailable` prop; the alert carries the `viewer-webgl-unavailable` class.
