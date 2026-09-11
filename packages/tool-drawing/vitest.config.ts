import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // jsdom, for the renderer's component tests. The geometry and layout
    // suites are pure and do not need it, but one environment is cheaper to
    // reason about than a per-file split, and neither is slow.
    //
    // jsdom has no `ResizeObserver`, which is not a gap here: the component
    // guards for it and falls back to the unmeasured frame, so every component
    // test exercises the default-box path on purpose.
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
