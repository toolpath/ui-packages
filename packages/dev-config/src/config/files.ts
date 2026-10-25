import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import picomatch from 'picomatch'

/** Every TS/JS extension the standard owns. */
export const SCRIPT_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
] as const

/**
 * Output and dependency directories that are never maintained source. The
 * reserved `.toolpath/ci-source` checkout is the central workflow's own source
 * inside a consumer's CI workspace.
 */
export const BUILT_IN_EXCLUSIONS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.react-router/**',
  '**/.expo/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/.vite/**',
  '**/test-results/**',
  '**/playwright-report/**',
  '**/blob-report/**',
  '**/.toolpath/ci-source/**',
  '**/.toolpath/reports/**',
] as const

export const toPosix = (path: string): string => path.split(sep).join('/')

/** `path` relative to `root`, with forward slashes; `''` for the root itself. */
export const relativePosix = (root: string, path: string): string => toPosix(relative(root, path))

export const isScriptFile = (path: string): boolean =>
  SCRIPT_EXTENSIONS.some((extension) => path.endsWith(extension))

export type Matcher = (path: string) => boolean

/** One matcher for many globs, matching repository-relative POSIX paths, dotfiles included. */
export const createMatcher = (globs: ReadonlyArray<string>): Matcher => {
  if (globs.length === 0) {
    return () => false
  }
  const match = picomatch([...globs], { dot: true })
  return (path) => match(path)
}

export const isExcludedByDefault = createMatcher(BUILT_IN_EXCLUSIONS)

/** Whether `path` (POSIX, repository-relative) lies inside directory `directory` (`'.'` is the root). */
export const isWithin = (directory: string, path: string): boolean =>
  directory === '.' || path === directory || path.startsWith(`${directory}/`)

const gitFiles = (root: string): Array<string> | undefined => {
  const inside = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: root,
    encoding: 'utf8',
  })
  if (inside.status !== 0 || inside.stdout.trim() !== 'true') {
    return undefined
  }
  const listed = spawnSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    },
  )
  if (listed.status !== 0) {
    return undefined
  }
  return listed.stdout.split('\0').filter((path) => path !== '' && existsSync(join(root, path)))
}

const walk = (root: string, directory: string, found: Array<string>): void => {
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const path = directory === '' ? entry.name : `${directory}/${entry.name}`
    if (entry.isDirectory()) {
      if (!isExcludedByDefault(`${path}/`)) {
        walk(root, path, found)
      }
    } else if (entry.isFile()) {
      found.push(path)
    }
  }
}

/**
 * Files under `root`, repository-relative with forward slashes. Uses Git's view
 * (tracked plus untracked, honouring ignores) when `root` is in a work tree, so
 * build output and local caches stay out; otherwise walks the directory.
 */
export const listFiles = (root: string): Array<string> => {
  const found =
    gitFiles(root) ??
    (() => {
      const walked: Array<string> = []
      walk(root, '', walked)
      return walked
    })()
  return found
    .filter((path) => !isExcludedByDefault(path) && statSync(join(root, path)).isFile())
    .sort()
}
