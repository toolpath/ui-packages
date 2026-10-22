import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Plan mode is plain rules over plain data, read by servers and browsers alike, so its tests
    // run with no DOM. `tests/package-imports.test.ts` checks that it imports only
    // `@toolpath/tool-support`.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
