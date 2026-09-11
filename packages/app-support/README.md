# Toolpath App Support

`@toolpath/app-support` is the logic a Toolpath application reuses: the
preferences, contexts and route helpers every application was otherwise going
to write for itself, and did.

**It renders nothing.** `@toolpath/ui` is the component kit — styling and
display, the surface documented in
[Storybook](https://storybook.staging.toolpath.com). This package is the other
half. Neither depends on the other, and that is the point: a preference read by
a loader on a server has no business pulling in a Tailwind component kit, and a
button has no business knowing where a preference is stored.

```
    @toolpath/tool-support          depends on nothing
             ↑
    @toolpath/app-support           the logic          ─┐
                                                        ├─  your application
    @toolpath/ui                    the components     ─┘
```

## Install

```sh
npm install @toolpath/app-support react react-dom
```

`react` and `react-dom` are peer dependencies, needed only for the `/react`
subpath.

## Two entry points

`@toolpath/app-support` imports no React. A preference is read by a loader on a
server as often as by a component in a browser, so the half that does not need
React does not import it.

```ts
import { loadUnit, saveUnit } from '@toolpath/app-support'

const unit = loadUnit(globalThis.localStorage ?? null, 'catalog.unit')
```

`@toolpath/app-support/react` is the hooks and contexts.

```tsx
import { useUnit } from '@toolpath/app-support/react'

export const UnitToggle = () => {
  const [unit, choose] = useUnit('catalog.unit')

  return (
    <button type="button" onClick={() => choose(unit === 'inches' ? 'millimeters' : 'inches')}>
      {unit}
    </button>
  )
}
```

## The unit a person reads in

The unit belongs to the person rather than to the thing being looked at: a
machinist works in one of them all day and should not set it again after
opening a report or a catalog.

- **The storage and the key are the caller's.** Passing the storage in is what
  lets this be called on a server or in a test without a `window`. Taking the
  key means two applications on one origin hold their own units instead of
  silently sharing one.
- **`loadUnit` reads the older `'in'` spelling as well as `'inches'`.** Those
  values are in people's browsers now, and a reader that accepts only the
  current spelling moves every inch shop to metric the day it deploys.
- **`useUnit` opens on millimetres and reads the stored preference on the first
  effect**, so a server render and its hydration agree instead of flashing the
  wrong numbers.

The vocabulary is `@toolpath/tool-support`'s `UnitSystem`, which is this
package's one runtime dependency.

## Where this came from

`loadUnit`, `saveUnit` and `useUnit` shipped in `@toolpath/ui` 0.2.0 and 0.3.0.
That was the wrong package: the component kit is styling and display, and
storage policy is neither. They live here from `@toolpath/ui` 1.0.0 onward.

## License

MIT
