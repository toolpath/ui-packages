// Shared lifecycle for Node and universal Vitest suites. Mocks are cleared and
// spies restored by the factory's config; this returns timers to real time so a
// test that installs fake timers cannot leak them into the next.
import { afterEach, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})
