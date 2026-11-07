import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Real popup and keyboard interactions share the same completion budget as app suites.
    testTimeout: 30_000,
    reporters: process.env.CI ? ['default', 'json'] : ['default'],
    outputFile: { json: '.turbo/vitest-results.json' },
    projects: [
      {
        extends: true,
        // Plain `.ts` suites (logic, source and package checks) need no DOM.
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          // Bundle the large icon graph once; each test file stays isolated.
          deps: {
            optimizer: {
              client: {
                enabled: true,
                include: ['@phosphor-icons/react'],
              },
            },
          },
          include: ['tests/**/*.test.tsx'],
          setupFiles: ['./tests/setup.ts'],
        },
      },
    ],
  },
})
