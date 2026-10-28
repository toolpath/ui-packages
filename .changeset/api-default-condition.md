---
'@toolpath/api': patch
---

`@toolpath/api` has a `default` export condition beside `import`, and exports `./package.json`, so a
resolver that asks for `require` (Jest under `jest-expo`, say) finds the package. The files are still
ES modules only: a plain Node `require()` of them needs Node 20.19+ or 22.12+. The Python SDK's
version moves with this release; its code is unchanged.
