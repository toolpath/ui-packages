import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { findStylingFaults } from './styling-home.mjs'

let root

const write = async (path, contents = '') => {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), contents)
}

const aPackage = (dir, manifest = {}) =>
  write(`packages/${dir}/package.json`, JSON.stringify({ name: `@toolpath/${dir}`, ...manifest }))

const faultsOf = async () => (await findStylingFaults(root)).faults

describe('findStylingFaults', () => {
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'styling-home-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('passes a logic package', async () => {
    await aPackage('logic', { dependencies: { '@toolpath/tool-support': 'workspace:^' } })
    await write('packages/logic/src/index.ts')

    assert.deepEqual(await faultsOf(), [])
    assert.equal((await findStylingFaults(root)).checked, 1)
  })

  it('fails a stylesheet anywhere in the package', async () => {
    await aPackage('logic')
    await write('packages/logic/logic.css')
    await write('packages/logic/src/theme.scss')
    await write('packages/logic/src/theme.less')

    assert.deepEqual(
      (await faultsOf()).map(({ where, file }) => [where, file]),
      [
        ['packages/logic', 'logic.css'],
        ['packages/logic', 'src/theme.less'],
        ['packages/logic', 'src/theme.scss'],
      ],
    )
  })

  it('fails a .tsx under src/', async () => {
    await aPackage('logic')
    await write('packages/logic/src/view/rule-list.tsx')

    assert.deepEqual(
      (await faultsOf()).map(({ file }) => file),
      ['src/view/rule-list.tsx'],
    )
  })

  it('fails a styling dependency, peer or optional dependency', async () => {
    await aPackage('logic', {
      dependencies: {
        '@phosphor-icons/react': '2.1.10',
        '@base-ui/react': '1.2.0',
        clsx: '^2.1.1',
        'tailwind-merge': '^3.4.0',
      },
      peerDependencies: { '@toolpath/ui': '^1.0.0', tailwindcss: '^4.0.0' },
      optionalDependencies: { '@tailwindcss/vite': '^4.0.0' },
    })

    assert.deepEqual(
      (await faultsOf()).map(({ file, rule }) => `${file}: ${rule.split(' ')[0]}`),
      [
        'package.json dependencies: @phosphor-icons/react',
        'package.json dependencies: @base-ui/react',
        'package.json dependencies: clsx',
        'package.json dependencies: tailwind-merge',
        'package.json peerDependencies: @toolpath/ui',
        'package.json peerDependencies: tailwindcss',
        'package.json optionalDependencies: @tailwindcss/vite',
      ],
    )
  })

  it('leaves the kit and the named exceptions alone', async () => {
    for (const dir of ['ui', 'viewer', 'tool-drawing']) {
      await aPackage(dir, { peerDependencies: { tailwindcss: '^4.0.0' } })
      await write(`packages/${dir}/src/view.tsx`)
      await write(`packages/${dir}/theme.css`)
    }

    assert.deepEqual(await faultsOf(), [])
  })

  it('reads no build output or installs', async () => {
    await aPackage('logic')
    await write('packages/logic/dist/index.css')
    await write('packages/logic/node_modules/kit/theme.css')

    assert.deepEqual(await faultsOf(), [])
  })
})
