import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // jsdom, for the `./react` suites and for the browser storage the root
    // entry is written against. The pure suites do not need it, but one
    // environment is cheaper to reason about than a per-file split.
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
