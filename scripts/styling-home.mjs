/**
 * **`@toolpath/ui` is the one home for styling.** Every other package ships
 * logic, data types and functions: no stylesheet, no `.tsx`, and no
 * dependency on the kit, its icons, its primitives or Tailwind.
 *
 * `@toolpath/dfm` is why this is a check. It shipped its React views, a
 * `dfm.css`, Phosphor and a peer on `@toolpath/ui`, so an app that wanted only
 * the rules took the kit's global theme, its icons and its primitives with
 * them. The views moved into the kit; this keeps the next package from
 * growing the same way.
 *
 * Two places read these lists — `eslint.config.js`, for the signal in an
 * editor, and `check-styling-home.mjs`, for the files and manifests ESLint
 * cannot see — so they live here once and the two cannot disagree.
 */

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * The packages that may style, each with the reason. A new one needs a line
 * here and in AGENTS.md's "Where code goes", in the same pull request.
 */
export const STYLED_PACKAGES = {
  'packages/ui': 'the component kit: the home for CSS, Tailwind, theme tokens and icons',
  'packages/viewer': 'three.js rendering, with its own pure `render/theme`',
  'packages/tool-drawing': 'an SVG elevation drawing of a tool and holder',
}

/** Import specifiers only a styled package may name, as ESLint `no-restricted-imports` patterns. */
export const STYLING_IMPORTS = [
  '@toolpath/ui',
  '@toolpath/ui/*',
  '@phosphor-icons/*',
  '@base-ui/*',
  'tailwindcss',
  '@tailwindcss/*',
  'clsx',
  'tailwind-merge',
  '*.css',
  '*.scss',
  '*.less',
]

/** Dependencies only a styled package may declare: the kit, its icons, its primitives, Tailwind and its class helpers. */
const STYLING_DEPENDENCY =
  /^(@toolpath\/ui|@phosphor-icons\/.+|@base-ui\/.+|tailwindcss|@tailwindcss\/.+|clsx|tailwind-merge)$/

/** Stylesheets in any of the languages a bundler reads. */
const STYLESHEET = /\.(css|scss|sass|less)$/

const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'coverage', '.turbo'])

/** Every file under `dir`, as paths relative to `base`, build output and installs left out. */
const filesUnder = async (dir, base = dir) => {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIPPED_DIRECTORIES.has(entry.name)) {
      continue
    }
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...(await filesUnder(path, base)))
    } else {
      found.push(path.slice(base.length + 1))
    }
  }
  return found
}

const readManifest = async (packageDir) => {
  try {
    return JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

const fileFaults = (where, files) =>
  files.flatMap((file) => {
    if (STYLESHEET.test(file)) {
      return [{ where, file, rule: 'a stylesheet; CSS belongs in @toolpath/ui' }]
    }
    if (file.startsWith('src/') && file.endsWith('.tsx')) {
      return [{ where, file, rule: 'a React view; views belong in @toolpath/ui' }]
    }
    return []
  })

const dependencyFaults = (where, manifest) =>
  ['dependencies', 'peerDependencies', 'optionalDependencies'].flatMap((field) =>
    Object.keys(manifest[field] ?? {})
      .filter((name) => STYLING_DEPENDENCY.test(name))
      .map((name) => ({
        where,
        file: `package.json ${field}`,
        rule: `${name} is styling; only @toolpath/ui and the named exceptions may depend on it`,
      })),
  )

/**
 * Every place a package outside `STYLED_PACKAGES` holds styling, for the
 * packages under `root/packages`. `checked` counts the packages read, so a
 * caller can tell a clean tree from one the walk never reached.
 */
export const findStylingFaults = async (root) => {
  const faults = []
  let checked = 0
  for (const entry of await readdir(join(root, 'packages'), { withFileTypes: true })) {
    const where = `packages/${entry.name}`
    if (!entry.isDirectory() || where in STYLED_PACKAGES) {
      continue
    }
    const manifest = await readManifest(join(root, where))
    if (manifest === null) {
      continue
    }
    checked += 1
    faults.push(...fileFaults(where, await filesUnder(join(root, where))))
    faults.push(...dependencyFaults(where, manifest))
  }
  return { checked, faults }
}
