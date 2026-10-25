# Generic consumer template

Files the packed-package and compatibility harnesses materialize into disposable
repositories outside this monorepo. Sources carry a `.tmpl` suffix so no tool in
this repository treats them as maintained code; the harness drops it when it
copies them. `node/` is a pure function with a test, `react/` a component with a
DOM behaviour test. They are deliberately tiny and name no real application.
