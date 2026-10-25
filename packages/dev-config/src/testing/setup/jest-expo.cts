// Shared lifecycle for Jest Expo suites. The factory's config clears mocks and
// restores spies; this returns timers to real time after every test, so a test
// that installs fake timers cannot leak them into the next. React Native
// Testing Library registers its own cleanup through Jest's `afterEach`.
//
// CommonJS on purpose: Jest loads setup files through its CommonJS module
// system and does not transform files under node_modules.

interface JestLifecycle {
  afterEach?: (callback: () => void) => void
  jest?: { useRealTimers: () => unknown }
}

const lifecycle = globalThis as unknown as JestLifecycle

lifecycle.afterEach?.(() => {
  lifecycle.jest?.useRealTimers()
})
