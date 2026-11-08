import { existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { STYLING_MESSAGE } from './styling.js'

interface Node {
  type: string
  computed?: boolean
  expression?: Node
  name?: { name?: unknown }
  source?: { value?: unknown } | null
}

interface Context {
  filename: string
  report: (descriptor: { node: unknown; message: string }) => void
}

/** The closest directory at or above `directory` holding a `package.json`. */
const packageRoot = (directory: string): string | undefined => {
  if (existsSync(join(directory, 'package.json'))) {
    return directory
  }
  const parent = dirname(directory)
  return parent === directory ? undefined : packageRoot(parent)
}

/** The directory an import resolves from: the path itself for a directory, else its folder. */
const resolvedDirectory = (target: string): string =>
  existsSync(target) && statSync(target).isDirectory() ? target : dirname(target)

const noRelativePackages = {
  create: (context: Context) => {
    const home = packageRoot(dirname(context.filename))
    const check = (node: Node): void => {
      const source = node.source?.value
      if (typeof source !== 'string' || !source.startsWith('.')) {
        return
      }
      const target = packageRoot(resolvedDirectory(resolve(dirname(context.filename), source)))
      if (target !== home) {
        context.report({ node, message: `Import this through its package, not ${source}.` })
      }
    }
    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
    }
  },
}

const noStylingAttributes = {
  create: (context: Context) => ({
    JSXAttribute: (node: Node): void => {
      const attribute = node.name?.name
      if (attribute === 'className' || attribute === 'style') {
        context.report({ node, message: STYLING_MESSAGE })
      }
    },
  }),
}

const noNonNullOutsideIndex = {
  create: (context: Context) => ({
    TSNonNullExpression: (node: Node): void => {
      const inner = node.expression
      if (inner?.type !== 'MemberExpression' || inner.computed !== true) {
        context.report({
          node,
          message: 'Prove the value exists with a guard; `!` is allowed only on an index access.',
        })
      }
    },
  }),
}

/** The rules oxlint has no equivalent for, loaded as a JS plugin by `createOxlintConfig`. */
export default {
  meta: { name: 'toolpath' },
  rules: {
    'no-non-null-outside-index': noNonNullOutsideIndex,
    'no-relative-packages': noRelativePackages,
    'no-styling-attributes': noStylingAttributes,
  },
}
