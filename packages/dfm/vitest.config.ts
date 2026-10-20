import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Nothing here touches a DOM, and nothing here is allowed to: the package
    // is the DFM rules and the checker, and the views over them are in
    // `@toolpath/ui`. `tests/subpaths.test.ts` is the check; this is the same
    // claim stated in the environment the suite runs in.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
