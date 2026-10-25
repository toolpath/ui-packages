import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findInstalledPackage } from '../config/packages.js'
import type { ResolvedConfig, ResolvedProject } from '../config/resolve.js'
import type { ReactAdapter } from '../config/types.js'
import type { Issue } from '../errors.js'
import { toolchain } from '../policy/toolchain.js'
import { COMPILER_PACKAGE } from './compiler.js'

/**
 * Read-only checks `doctor` runs for each React project: the adapter's tools are
 * the tested versions, the native build config actually imports the adapter,
 * the compiler targets the oldest React the package supports, and a React 17/18
 * target ships its runtime as a real dependency.
 */

const CONFIG_EXTENSIONS = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs']

const files = (stems: ReadonlyArray<string>): Array<string> =>
  stems.flatMap((stem) => CONFIG_EXTENSIONS.map((extension) => `${stem}.${extension}`))

interface Wiring {
  /** Candidate native config files, project-relative. */
  configFiles: Array<string>
  /** The import that proves the adapter is wired into that config. */
  specifier: string
  remedy: string
}

export const ADAPTER_WIRING: Readonly<Record<ReactAdapter, Wiring>> = {
  'vite-legacy': {
    configFiles: files(['vite.config']),
    specifier: '@toolpath/dev-config/react/vite',
    remedy: 'add `...(await createReactPlugins(config, { project }))` to its plugins',
  },
  'vite-modern': {
    configFiles: files(['vite.config']),
    specifier: '@toolpath/dev-config/react/vite',
    remedy: 'add `...(await createReactPlugins(config, { project }))` to its plugins',
  },
  'react-router': {
    configFiles: files(['vite.config']),
    specifier: '@toolpath/dev-config/react/babel',
    remedy: 'add `await createReactRouterCompilerPlugin(config, { project })` after reactRouter()',
  },
  babel: {
    configFiles: [...files(['babel.config', '.babelrc']), 'babel.config.json', '.babelrc.json'],
    specifier: '@toolpath/dev-config/react/babel',
    remedy:
      'export createBabelConfig(config, { project }) or put createReactCompilerBabelPlugin first in its plugins',
  },
  expo: {
    configFiles: files(['babel.config']),
    specifier: '@toolpath/dev-config/react/expo',
    remedy: 'return createExpoBabelConfig(config, { project }) from it',
  },
  'library-esbuild': {
    configFiles: [
      ...files(['tsup.config', 'esbuild.config', 'build.config']),
      ...files(['scripts/build']),
    ],
    specifier: '@toolpath/dev-config/react/library',
    remedy:
      'add reactCompilerEsbuildPlugin(config, { project }) to its esbuild plugins (tsup: esbuildPlugins)',
  },
}

/** The lowest React major a semver range admits, or undefined when it is not a range this reads. */
export const lowestMajor = (range: string): number | undefined => {
  const majors = range
    .split('||')
    .map((set) => {
      const lower = set
        .trim()
        .split(/\s+/)
        .map((comparator) =>
          /^(?:\^|~|>=|=)?v?(\d+)(?:\.(?:\d+|x|\*)){0,2}$/i.exec(comparator.trim()),
        )
        .find((match) => match !== null)
      return lower?.[1] === undefined ? undefined : Number.parseInt(lower[1], 10)
    })
    .filter((major): major is number => major !== undefined)
  return majors.length === 0 ? undefined : Math.min(...majors)
}

const versionsFor = (profile: string): Record<string, Array<string>> =>
  Object.fromEntries(
    Object.entries(toolchain.profiles[profile] ?? {}).map(([name, versions]) => [
      name,
      [versions].flat(),
    ]),
  )

const at = (project: ResolvedProject): string =>
  project.path === '.' ? project.name : project.path

const versionIssues = (
  project: ResolvedProject,
  packages: Record<string, Array<string>>,
): Array<Issue> =>
  Object.entries(packages).flatMap(([name, versions]) => {
    const installed = findInstalledPackage(project.directory, name)
    if (!installed) {
      return [
        {
          path: at(project),
          message: `the ${project.react?.adapter ?? 'React'} adapter needs ${name}@${versions[0] ?? ''} as an exact dev dependency; it is not installed`,
        },
      ]
    }
    return versions.includes(installed.version)
      ? []
      : [
          {
            path: at(project),
            message: `${name}@${installed.version} is installed; this release is tested with ${versions.join(' or ')}`,
          },
        ]
  })

const wiringIssues = (project: ResolvedProject, adapter: ReactAdapter): Array<Issue> => {
  const wiring = ADAPTER_WIRING[adapter]
  const present = wiring.configFiles.filter((file) => existsSync(join(project.directory, file)))
  if (present.length === 0) {
    return [
      {
        path: at(project),
        message: `no ${wiring.configFiles[0] ?? 'build config'} found for the '${adapter}' React adapter; create it and ${wiring.remedy}`,
      },
    ]
  }
  const wired = present.some((file) =>
    readFileSync(join(project.directory, file), 'utf8').includes(wiring.specifier),
  )
  return wired
    ? []
    : [
        {
          path: `${project.path === '.' ? '' : `${project.path}/`}${present[0] ?? ''}`,
          message: `does not import ${wiring.specifier}, so React Compiler is not part of this build; ${wiring.remedy}`,
        },
      ]
}

const expoIssues = (project: ResolvedProject): Array<Issue> => {
  const issues: Array<Issue> = []
  const expo = findInstalledPackage(project.directory, 'expo')
  const testedMajor = toolchain.tested.expo?.split('.')[0]
  if (!expo) {
    issues.push({
      path: at(project),
      message: 'the expo React adapter needs the expo package installed',
    })
  } else if (expo.version.split('.')[0] !== testedMajor) {
    issues.push({
      path: at(project),
      message: `expo@${expo.version} is installed; this release is tested with Expo SDK ${testedMajor ?? ''}`,
    })
  }
  const appJson = join(project.directory, 'app.json')
  let staticFlag = false
  if (existsSync(appJson)) {
    try {
      const parsed = JSON.parse(readFileSync(appJson, 'utf8')) as {
        expo?: { experiments?: { reactCompiler?: unknown } }
      }
      staticFlag = parsed.expo?.experiments?.reactCompiler === true
    } catch {
      issues.push({ path: 'app.json', message: 'is not valid JSON' })
    }
  }
  // An app.config.* receives app.json as its input, so either may enable the experiment.
  const dynamic = files(['app.config']).find((file) => existsSync(join(project.directory, file)))
  const dynamicFlag =
    dynamic !== undefined &&
    /\breactCompiler\s*:\s*true|withReactCompiler\(/.test(
      readFileSync(join(project.directory, dynamic), 'utf8'),
    )
  if (!staticFlag && !dynamicFlag) {
    issues.push({
      path: dynamic ?? (existsSync(appJson) ? 'app.json' : at(project)),
      message:
        'does not enable experiments.reactCompiler, so Metro never asks babel-preset-expo for the compiler; set it in app.json or wrap app.config with withReactCompiler',
    })
  }
  const babelConfig = files(['babel.config']).find((file) =>
    existsSync(join(project.directory, file)),
  )
  if (babelConfig) {
    const text = readFileSync(join(project.directory, babelConfig), 'utf8')
    if (text.includes(COMPILER_PACKAGE)) {
      issues.push({
        path: babelConfig,
        message: `names ${COMPILER_PACKAGE} directly; babel-preset-expo already runs it, so components would compile twice`,
      })
    }
  }
  return issues
}

const runtimeIssues = (project: ResolvedProject): Array<Issue> => {
  const react = project.react
  if (!react) {
    return []
  }
  const issues: Array<Issue> = []
  const declared =
    project.manifest?.peerDependencies?.react ?? project.manifest?.dependencies?.react
  const lowest = declared === undefined ? undefined : lowestMajor(declared)
  const target = Number.parseInt(react.minimumVersion, 10)
  if (lowest !== undefined && lowest < target) {
    issues.push({
      path: at(project),
      message: `package.json allows React ${String(lowest)} (${declared ?? ''}), but react.minimumVersion is '${react.minimumVersion}'. Set minimumVersion: '${String(Math.max(17, lowest))}' so the compiled output runs on every React the package accepts`,
    })
  }
  if (react.minimumVersion !== '19') {
    const runtime = project.manifest?.dependencies?.['react-compiler-runtime']
    const installed = findInstalledPackage(project.directory, 'react-compiler-runtime')
    if (runtime === undefined) {
      issues.push({
        path: at(project),
        message: `targets React ${react.minimumVersion}, so compiled code imports react-compiler-runtime; add react-compiler-runtime@${toolchain.react.compilerRuntime} to its dependencies (a reviewed runtime dependency change)`,
      })
    } else if (installed && installed.version !== toolchain.react.compilerRuntime) {
      issues.push({
        path: at(project),
        message: `react-compiler-runtime@${installed.version} is installed; this release is tested with ${toolchain.react.compilerRuntime}`,
      })
    }
  }
  return issues
}

/** Every React adapter problem in the repository, for `doctor`. */
export const reactAdapterIssues = (resolved: ResolvedConfig): Array<Issue> =>
  resolved.projects.flatMap((project) => {
    const adapter = project.react?.adapter
    if (!adapter) {
      return []
    }
    return [
      ...versionIssues(project, versionsFor('react')),
      ...versionIssues(project, versionsFor(`react-${adapter}`)),
      ...(adapter === 'expo' ? expoIssues(project) : []),
      ...wiringIssues(project, adapter),
      ...runtimeIssues(project),
    ]
  })
