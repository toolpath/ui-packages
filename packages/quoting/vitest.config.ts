import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The model is plain rules over plain data, read by servers and browsers alike, so its tests
    // run with no DOM. `tests/subpaths.test.ts` checks that it imports no package.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
