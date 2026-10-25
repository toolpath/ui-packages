// Builds the package with its own pinned TypeScript: declarations, assets, and
// release metadata. No SDK generation, sibling sources, global tools or network.
import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildInputsHash } from './build-inputs.mjs'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const release = process.argv.includes('--release')
const dist = join(packageRoot, 'dist')
const tsc = createRequire(join(packageRoot, 'package.json')).resolve('typescript/bin/tsc')

rmSync(dist, { recursive: true, force: true })
const compiled = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], {
  cwd: packageRoot,
  stdio: 'inherit',
})
if (compiled.status !== 0) {
  process.stderr.write('@toolpath/dev-config: the TypeScript build failed.\n')
  process.exit(compiled.status ?? 1)
}

cpSync(join(packageRoot, 'src/policy/toolchain.json'), join(dist, 'policy/toolchain.json'))
chmodSync(join(dist, 'cli/main.js'), 0o755)

// The identity module is part of the build output, so it runs in its own process
// once that output exists.
const identityScript = `
import { writeFileSync } from 'node:fs'
const [packageRoot, channel, target] = process.argv.slice(1)
const { createReleaseIdentity } = await import(new URL('release/metadata.js', target).href)
writeFileSync(new URL('release.json', target), JSON.stringify(createReleaseIdentity({ packageRoot, channel }), null, 2) + '\\n')
`
const identity = spawnSync(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    identityScript,
    packageRoot,
    release ? 'release' : 'development',
    pathToFileURL(`${dist}/`).href,
  ],
  { cwd: packageRoot, encoding: 'utf8' },
)
if (identity.status !== 0) {
  rmSync(dist, { recursive: true, force: true })
  process.stderr.write(identity.stderr.replace(/^[\s\S]*?(UsageError|Error): /m, ''))
  process.exit(2)
}
writeFileSync(join(dist, '.build-inputs'), `${buildInputsHash(packageRoot)}\n`)
