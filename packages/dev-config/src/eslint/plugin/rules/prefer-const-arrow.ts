import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils'
import { createRule } from '../create-rule.js'

type FunctionNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression
type MessageIds = 'preferConstArrow' | 'preferArrowExpression' | 'convert'

/**
 * Whether a function's own body (not nested non-arrow functions) uses behaviour
 * an arrow function does not have: `this`, `arguments`, `new.target`, `super`.
 */
const usesDynamicBinding = (node: FunctionNode): boolean => {
  let found = false
  const visit = (current: TSESTree.Node | null | undefined, insideOwnScope: boolean): void => {
    if (!current || found) {
      return
    }
    switch (current.type) {
      case AST_NODE_TYPES.ThisExpression:
      case AST_NODE_TYPES.Super:
        if (insideOwnScope) {
          found = true
        }
        return
      case AST_NODE_TYPES.Identifier:
        if (insideOwnScope && current.name === 'arguments') {
          found = true
        }
        return
      case AST_NODE_TYPES.MetaProperty:
        if (insideOwnScope && current.meta.name === 'new' && current.property.name === 'target') {
          found = true
        }
        return
      case AST_NODE_TYPES.FunctionDeclaration:
      case AST_NODE_TYPES.FunctionExpression:
        if (current !== node) {
          return
        }
        break
      case AST_NODE_TYPES.ClassBody:
        return
      default:
        break
    }
    for (const [key, value] of Object.entries(current)) {
      if (key === 'parent' || key === 'loc' || key === 'range') {
        continue
      }
      if (Array.isArray(value)) {
        for (const child of value as Array<unknown>) {
          if (child !== null && typeof child === 'object' && 'type' in child) {
            visit(child as TSESTree.Node, insideOwnScope)
          }
        }
      } else if (value !== null && typeof value === 'object' && 'type' in value) {
        visit(value as TSESTree.Node, insideOwnScope)
      }
    }
  }
  visit(node.body, true)
  for (const parameter of node.params) {
    visit(parameter, true)
  }
  return found
}

/** A TypeScript `this` parameter (`function f(this: Window)`) needs a dynamic receiver. */
const declaresThisParameter = (node: FunctionNode): boolean =>
  node.params.some(
    (parameter) => parameter.type === AST_NODE_TYPES.Identifier && parameter.name === 'this',
  )

const hasOverloads = (node: TSESTree.FunctionDeclaration): boolean => {
  const container =
    node.parent.type === AST_NODE_TYPES.ExportNamedDeclaration ? node.parent.parent : node.parent
  if (!('body' in container) || !Array.isArray(container.body)) {
    return false
  }
  const name = node.id?.name
  return (container.body as Array<TSESTree.Node>).some((statement) => {
    const declaration =
      statement.type === AST_NODE_TYPES.ExportNamedDeclaration ? statement.declaration : statement
    return declaration?.type === AST_NODE_TYPES.TSDeclareFunction && declaration.id?.name === name
  })
}

const SAFE_CONTAINERS = new Set<string>([
  AST_NODE_TYPES.Program,
  AST_NODE_TYPES.BlockStatement,
  AST_NODE_TYPES.ExportNamedDeclaration,
  AST_NODE_TYPES.TSModuleBlock,
])

const isJsxFile = (filename: string): boolean => /\.[cm]?[jt]sx$/.test(filename)

export const preferConstArrow = createRule<[], MessageIds>({
  name: 'prefer-const-arrow',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require `const` arrow functions where an arrow has the same semantics as the function it replaces.',
    },
    fixable: 'code',
    hasSuggestions: true,
    messages: {
      preferConstArrow: 'Declare `{{name}}` as a `const` arrow function.{{detail}}',
      preferArrowExpression:
        'Use an arrow function; this function uses no `this`, `arguments` or `new.target`.',
      convert: 'Convert to a `const` arrow function (review hoisting and reassignment first).',
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => {
    const sourceCode = context.sourceCode
    const jsx = isJsxFile(context.filename)

    const typeParameters = (node: FunctionNode): string => {
      if (!node.typeParameters) {
        return ''
      }
      const text = sourceCode.getText(node.typeParameters)
      // `<T>() =>` reads as a JSX tag in .tsx; a trailing comma keeps it a type parameter list.
      if (
        jsx &&
        node.typeParameters.params.length === 1 &&
        !text.includes(',') &&
        !text.includes('extends')
      ) {
        return `${text.slice(0, -1)},>`
      }
      return text
    }

    /** The `(` that opens the parameter list: after the type parameters, else the node's first `(`. */
    const parameterListStart = (node: FunctionNode): TSESTree.Token | null =>
      node.typeParameters
        ? sourceCode.getTokenAfter(node.typeParameters)
        : sourceCode.getFirstToken(node, { filter: (token) => token.value === '(' })

    /**
     * `(params): ReturnType => body`, keeping the original source of each part and
     * the comments inside them. Undefined when a comment sits before the parameter
     * list, where the rewrite would drop it.
     */
    const arrowText = (node: FunctionNode): string | undefined => {
      const open = parameterListStart(node)
      if (!open) {
        return undefined
      }
      const typeStart = node.typeParameters?.range[0] ?? open.range[0]
      if (sourceCode.getCommentsInside(node).some((comment) => comment.range[0] < typeStart)) {
        return undefined
      }
      const header = sourceCode.text.slice(open.range[0], node.body.range[0]).trimEnd()
      return `${node.async ? 'async ' : ''}${typeParameters(node)}${header} => ${sourceCode.getText(node.body)}`
    }

    const variableOf = (node: TSESTree.FunctionDeclaration): TSESLint.Scope.Variable | undefined =>
      sourceCode.getDeclaredVariables(node).find((variable) => variable.name === node.id?.name)

    return {
      FunctionDeclaration: (node) => {
        if (!node.id || node.generator) {
          return
        }
        if (node.parent.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
          return
        }
        if (hasOverloads(node) || declaresThisParameter(node) || usesDynamicBinding(node)) {
          return
        }

        const variable = variableOf(node)
        const references = variable?.references ?? []
        const constructed = references.some((reference) => {
          const parent = reference.identifier.parent
          return (
            (parent.type === AST_NODE_TYPES.NewExpression &&
              parent.callee === reference.identifier) ||
            (parent.type === AST_NODE_TYPES.MemberExpression &&
              parent.object === reference.identifier &&
              parent.property.type === AST_NODE_TYPES.Identifier &&
              parent.property.name === 'prototype')
          )
        })
        if (constructed) {
          return
        }

        const reassigned = references.some((reference) => reference.isWrite())
        const usedBeforeDeclaration = references.some(
          (reference) => reference.identifier.range[0] < node.range[0],
        )
        // Declarations directly in a `case`, `if` or label (legal in sloppy scripts) change scope as `const`.
        const container: string = node.parent.type
        const unsafeContainer = !SAFE_CONTAINERS.has(container)
        const name = node.id.name
        const arrow = arrowText(node)
        const fix =
          arrow === undefined
            ? undefined
            : (fixer: TSESLint.RuleFixer): TSESLint.RuleFix =>
                fixer.replaceText(node, `const ${name} = ${arrow}`)

        if (reassigned || usedBeforeDeclaration || unsafeContainer) {
          const detail = reassigned
            ? ' It is reassigned, so convert it by hand.'
            : usedBeforeDeclaration
              ? ' It is used before its declaration; if that relies on hoisting, keep it and suppress this line with the reason.'
              : ''
          context.report({
            node: node.id,
            messageId: 'preferConstArrow',
            data: { name, detail },
            suggest: unsafeContainer || reassigned || !fix ? [] : [{ messageId: 'convert', fix }],
          })
          return
        }
        context.report({
          node: node.id,
          messageId: 'preferConstArrow',
          data: { name, detail: '' },
          ...(fix ? { fix } : {}),
        })
      },
      FunctionExpression: (node) => {
        if (node.generator || declaresThisParameter(node) || usesDynamicBinding(node)) {
          return
        }
        const parent = node.parent
        // Methods, accessors and class members are declared with method syntax, not as values.
        if (
          parent.type === AST_NODE_TYPES.MethodDefinition ||
          parent.type === AST_NODE_TYPES.TSAbstractMethodDefinition ||
          (parent.type === AST_NODE_TYPES.Property && (parent.method || parent.kind !== 'init'))
        ) {
          return
        }
        if (parent.type === AST_NODE_TYPES.NewExpression) {
          return
        }
        // A named expression can call itself through its own name, which an arrow does not bind.
        if (node.id) {
          const self = sourceCode
            .getDeclaredVariables(node)
            .find((variable) => variable.name === node.id?.name)
          if (self && self.references.length > 0) {
            return
          }
        }
        const replacement = arrowText(node)
        // An arrow in callee position or before a member access needs parentheses to stay one expression.
        const needsParentheses =
          (parent.type === AST_NODE_TYPES.CallExpression && parent.callee === node) ||
          (parent.type === AST_NODE_TYPES.MemberExpression && parent.object === node) ||
          parent.type === AST_NODE_TYPES.TaggedTemplateExpression ||
          parent.type === AST_NODE_TYPES.BinaryExpression ||
          parent.type === AST_NODE_TYPES.LogicalExpression ||
          parent.type === AST_NODE_TYPES.UnaryExpression
        const alreadyParenthesized =
          sourceCode.getTokenBefore(node)?.value === '(' &&
          sourceCode.getTokenAfter(node)?.value === ')'
        context.report({
          node,
          messageId: 'preferArrowExpression',
          ...(replacement === undefined
            ? {}
            : {
                fix: (fixer: TSESLint.RuleFixer) =>
                  fixer.replaceText(
                    node,
                    needsParentheses && !alreadyParenthesized ? `(${replacement})` : replacement,
                  ),
              }),
        })
      },
    }
  },
})
