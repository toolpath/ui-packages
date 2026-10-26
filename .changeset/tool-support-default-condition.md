---
'@toolpath/tool-support': patch
---

Every entry point gains a `default` export condition beside `import`, so a resolver that asks for
`require`, such as Jest under `jest-expo`, finds the package, including when it reaches it through
`@toolpath/dfm`.
