import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import {
  inspectBuiltArtifact,
  platformResolveExtensions,
  reactCompilerEsbuildPlugin,
  reactLibraryCompilerOptions,
  type ReactCompilerEsbuildPlugin,
} from '../../src/react/library.js'
import { createTestProject } from './project.js'

interface OutputFile {
  path: string
  text: string
}
interface Esbuild {
  build: (options: Record<string, unknown>) => Promise<{ outputFiles: Array<OutputFile> }>
}

const BUTTON = (variant: string): string => `import { useState } from 'react'

export type ButtonProps = { label: string }

export const Button = ({ label }: ButtonProps) => {
  const [pressed, setPressed] = useState(false)
  return (
    <button type="button" data-variant="${variant}" aria-pressed={pressed} onClick={() => setPressed(!pressed)}>
      {label}
    </button>
  )
}
`

const project = createTestProject({
  adapter: 'library-esbuild',
  kind: 'library',
  runtime: 'universal',
  files: {
    'src/index.ts': "export { Button } from './Button'\nexport const VERSION: string = '1'\n",
    'src/Button.tsx': BUTTON('shared'),
    'src/Button.web.tsx': BUTTON('web-variant'),
    'src/Button.native.tsx': BUTTON('native-variant'),
    'src/math.ts': 'export const add = (a: number, b: number): number => a + b\n',
  },
})

afterAll(() => {
  project.remove()
})

const esbuild = async (): Promise<Esbuild> =>
  (await import(
    pathToFileURL(createRequire(join(project.directory, 'package.json')).resolve('esbuild')).href
  )) as Esbuild

const build = async (
  platform: 'web' | 'native',
): Promise<{ code: string; map: { sources: Array<string>; sourcesContent: Array<string> } }> => {
  const { outputFiles } = await (
    await esbuild()
  ).build({
    absWorkingDir: project.directory,
    entryPoints: ['src/index.ts'],
    bundle: true,
    format: 'esm',
    write: false,
    outfile: 'dist/index.js',
    sourcemap: 'external',
    jsx: 'automatic',
    external: ['react', 'react/*', 'react-native'],
    resolveExtensions: platformResolveExtensions(platform),
    plugins: [reactCompilerEsbuildPlugin(project.config, { project: 'app' })],
  })
  const code = outputFiles.find((file) => file.path.endsWith('.js'))?.text ?? ''
  const map = JSON.parse(outputFiles.find((file) => file.path.endsWith('.map'))?.text ?? '{}') as {
    sources: Array<string>
    sourcesContent: Array<string>
  }
  return { code, map }
}

describe('reactCompilerEsbuildPlugin', () => {
  it('compiles the shipped JavaScript and resolves the web variant', async () => {
    const { code } = await build('web')
    expect(inspectBuiltArtifact(code)).toMatchObject({
      compiled: true,
      runtimeModule: 'react/compiler-runtime',
    })
    expect(code).toContain('web-variant')
    expect(code).not.toContain('native-variant')
    // TypeScript was lowered by esbuild after the compiler ran.
    expect(code).not.toContain('ButtonProps')
  })

  it('resolves the native variant for a native build', async () => {
    const { code } = await build('native')
    expect(code).toContain('native-variant')
    expect(code).not.toContain('web-variant')
    expect(inspectBuiltArtifact(code).compiled).toBe(true)
  })

  it("chains Babel's source map, so the bundle maps to the original TypeScript", async () => {
    const { map } = await build('web')
    const index = map.sources.findIndex((source) => source.endsWith('Button.web.tsx'))
    expect(index).toBeGreaterThanOrEqual(0)
    expect(map.sourcesContent[index]).toContain('export type ButtonProps')
  })

  it('never compiles dependency code or files without components', async () => {
    let onLoad:
      Parameters<Parameters<ReactCompilerEsbuildPlugin['setup']>[0]['onLoad']>[1] | undefined
    reactCompilerEsbuildPlugin(project.config, { project: 'app' }).setup({
      onLoad: (_options, callback) => {
        onLoad = callback
      },
    })
    await expect(
      onLoad?.({ path: join(project.directory, 'node_modules/ui/Button.tsx'), namespace: 'file' }),
    ).resolves.toBeUndefined()
    await expect(
      onLoad?.({ path: join(project.directory, 'src/math.ts'), namespace: 'file' }),
    ).resolves.toBeUndefined()
    await expect(
      onLoad?.({ path: join(project.directory, 'src/Button.tsx'), namespace: 'file' }),
    ).resolves.toMatchObject({
      loader: 'tsx',
    })
  })

  it('targets the minimum React the library declares', () => {
    expect(reactLibraryCompilerOptions(project.config, { project: 'app' }).target).toBe('19')
  })
})

describe('platformResolveExtensions', () => {
  it('prefers platform files over the shared one', () => {
    expect(platformResolveExtensions('web').slice(0, 2)).toEqual(['.web.tsx', '.web.ts'])
    expect(platformResolveExtensions('ios')).toEqual(
      expect.arrayContaining(['.ios.tsx', '.native.tsx', '.tsx']),
    )
    expect(platformResolveExtensions('ios').indexOf('.ios.tsx')).toBeLessThan(
      platformResolveExtensions('ios').indexOf('.native.tsx'),
    )
  })
})
