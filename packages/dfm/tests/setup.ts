import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Without vitest globals, Testing Library cannot unmount on its own between tests.
afterEach(cleanup)

/** jsdom has no `ResizeObserver`, which `@toolpath/ui`'s `ScrollArea` needs to mount. */
class StubResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= StubResizeObserver

/** Nor `getAnimations`, which the `ScrollArea` asks of its viewport once a timer runs. */
Element.prototype.getAnimations ??= () => []
