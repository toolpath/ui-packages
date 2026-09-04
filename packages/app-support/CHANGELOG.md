# @toolpath/app-support

## 0.1.1

### Patch Changes

- 3638577: Republish with a resolvable dependency range. `0.1.0` declares
  `"@toolpath/tool-support": "workspace:^"`, which is pnpm's workspace protocol
  and not a version any registry client can resolve — `npm install
@toolpath/app-support` fails outright with `EUNSUPPORTEDPROTOCOL`. Nothing else
  about the package changes.

  `0.1.0` reached npm through the one-off bootstrap publish a package needs before
  npm will accept a trusted publisher, and that publish ran `npm publish` rather
  than `pnpm publish`. Only pnpm rewrites the range at pack time, which is why
  every package released through `changeset publish` is unaffected.
  `scripts/check-bootstrap-publish.mjs` is the check that keeps the two publish
  paths agreeing.

## 0.1.0

### Minor Changes

- 8e66848: New package: the logic a Toolpath application reuses, split from the component
  kit that renders it.

  `@toolpath/ui` is styling and display — the surface Storybook documents. Storage
  policy is neither, and `loadUnit`, `saveUnit` and `useUnit` shipped there in
  0.2.0 and 0.3.0 anyway. They live here now, unchanged in behavior, and leave
  `@toolpath/ui` in its next major.

  Two entry points. `@toolpath/app-support` imports no React, so a loader on a
  server can read a stored preference without bundling a renderer;
  `@toolpath/app-support/react` is the hooks and contexts. `react` and `react-dom`
  are peers, and `@toolpath/tool-support` is the one runtime dependency — its
  `UnitSystem` is the vocabulary, imported rather than restated.
