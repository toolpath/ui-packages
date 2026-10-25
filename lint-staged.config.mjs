// Two disjoint tasks in one lint-staged run. `packages/dev-config` formats with
// its own pinned policy (safe ESLint fixes, then Prettier 3.9), so the root's
// Prettier never rewrites it and two formatter versions cannot compete. Every
// other path keeps the root policy it always had.
import { spawnSync } from 'node:child_process'
import { relative } from 'node:path'

const DEV_CONFIG = 'packages/dev-config/'
const ROOT_FORMATTED = /\.(css|html|js|json|md|mjs|ts|tsx|yaml|yml)$/

const run = (args) => {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`${args.join(' ')} exited with ${result.status ?? result.signal}`)
  }
}

const inDevConfig = (file) =>
  relative(process.cwd(), file).split('\\').join('/').startsWith(DEV_CONFIG)

export default {
  'packages/dev-config/**': {
    title: '@toolpath/dev-config: safe lint fixes, then formatting',
    task: (files) => {
      // Builds the package only when its dist is missing or older than its sources.
      run([`${DEV_CONFIG}scripts/ensure-build.mjs`])
      run([
        `${DEV_CONFIG}dist/cli/main.js`,
        'hooks',
        'files',
        '--config',
        `${DEV_CONFIG}dev.config.mjs`,
        '--',
        ...files,
      ])
    },
  },
  '*': {
    title: 'prettier --write (root policy)',
    task: (files) => {
      const formatted = files.filter((file) => ROOT_FORMATTED.test(file) && !inDevConfig(file))
      if (formatted.length > 0)
        run(['node_modules/prettier/bin/prettier.cjs', '--write', '--', ...formatted])
    },
  },
}
