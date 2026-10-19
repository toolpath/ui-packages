/**
 * The logic a Toolpath application reuses, and nothing that renders.
 *
 * `@toolpath/ui` supplies visual components; this package supplies shared
 * application logic. Neither depends on the other.
 *
 * ## This entry imports no React
 *
 * A preference is read by a loader on a server as often as by a component in a
 * browser, so the half that does not need React does not import it. The hooks
 * and contexts are at `@toolpath/app-support/react`, and a barrel over both
 * would drag React into anything that only wanted to read a stored value.
 *
 * The vocabulary is `@toolpath/tool-support`'s, which is this package's one
 * runtime dependency and itself depends on nothing.
 */

export { loadUnit, saveUnit } from './unit-preference.js'
