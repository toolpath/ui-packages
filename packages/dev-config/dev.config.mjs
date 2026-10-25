// The package checks itself with its own built factories (`dist/`), so the
// bootstrap stays acyclic: plain TypeScript build first, then this policy.
import { defineConfig } from './dist/index.js'

export default defineConfig({
  schemaVersion: 1,
  root: import.meta.url,
  projects: [
    {
      name: 'dev-config',
      root: '.',
      kind: 'library',
      runtime: 'node',
      tsconfig: 'tsconfig.json',
      suites: {
        unit: { runner: 'vitest', config: 'vitest.config.ts' },
      },
    },
  ],
  formatIgnore: [
    {
      files: ['contracts/engine/**'],
      reason:
        'Public Engine contract snapshots are byte-retained; their recorded SHA-256 must keep matching',
    },
  ],
  ci: { node: '24.18.0' },
})
