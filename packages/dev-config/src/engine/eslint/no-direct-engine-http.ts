import { AST_NODE_TYPES, ESLintUtils, TSESLint, type TSESTree } from '@typescript-eslint/utils'

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/toolpath/ui-packages/blob/main/packages/dev-config/docs/engine-testing.md#toolpath-engine${name}`,
)

type Options = [{ origins: Array<string> }]

const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'self'])

/** The variable an identifier refers to in its scope, if any is declared. */
const variableFor = (
  sourceCode: TSESLint.SourceCode,
  identifier: TSESTree.Identifier,
): TSESLint.Scope.Variable | undefined => {
  let scope: TSESLint.Scope.Scope | null = sourceCode.getScope(identifier)
  while (scope) {
    const variable = scope.set.get(identifier.name)
    if (variable) {
      return variable
    }
    scope = scope.upper
  }
  return undefined
}

/** A variable bound once by `const` (or an import-free declaration never written again). */
const constantInitializer = (variable: TSESLint.Scope.Variable): TSESTree.Node | undefined => {
  const [definition] = variable.defs
  if (variable.defs.length !== 1 || !definition) {
    return undefined
  }
  if (definition.type !== TSESLint.Scope.DefinitionType.Variable) {
    return undefined
  }
  const declarator = definition.node
  if (declarator.parent.kind !== 'const') {
    return undefined
  }
  if (variable.references.some((reference) => reference.isWrite() && reference.init !== true)) {
    return undefined
  }
  return declarator.id.type === AST_NODE_TYPES.Identifier
    ? (declarator.init ?? undefined)
    : undefined
}

/** Whether an identifier names the global (undeclared, or only declared ambiently) binding. */
const isGlobalReference = (
  sourceCode: TSESLint.SourceCode,
  identifier: TSESTree.Identifier,
): boolean => {
  const variable = variableFor(sourceCode, identifier)
  return variable === undefined || variable.defs.length === 0
}

export const noDirectEngineHttp = createRule<Options, 'directEngineHttp'>({
  name: 'no-direct-engine-http',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow statically identifiable `fetch` calls to a configured Engine origin outside the integration and compatibility modules.',
    },
    messages: {
      directEngineHttp:
        'This fetch calls the Engine API at {{origin}} directly. Use the SDK from an integration module, or move deliberate raw HTTP into a declared compatibility module with its reason and tests.',
    },
    schema: [
      {
        type: 'object',
        properties: { origins: { type: 'array', items: { type: 'string' }, minItems: 1 } },
        required: ['origins'],
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ origins: [] }],
  create: (context, [{ origins }]) => {
    const sourceCode = context.sourceCode
    const engineOrigins = new Set(origins)

    /** The string a node evaluates to, when that is knowable without running code. */
    const staticString = (
      node: TSESTree.Node | null | undefined,
      depth = 0,
    ): string | undefined => {
      if (!node || depth > 8) {
        return undefined
      }
      switch (node.type) {
        case AST_NODE_TYPES.Literal:
          return typeof node.value === 'string' ? node.value : undefined
        case AST_NODE_TYPES.TemplateLiteral: {
          let text = node.quasis[0]?.value.cooked ?? ''
          for (let index = 0; index < node.expressions.length; index += 1) {
            const value = staticString(node.expressions[index], depth + 1)
            if (value === undefined) {
              return undefined
            }
            text += value + (node.quasis[index + 1]?.value.cooked ?? '')
          }
          return text
        }
        case AST_NODE_TYPES.BinaryExpression: {
          if (node.operator !== '+') {
            return undefined
          }
          const left = staticString(node.left, depth + 1)
          const right = staticString(node.right, depth + 1)
          return left === undefined || right === undefined ? undefined : left + right
        }
        case AST_NODE_TYPES.Identifier: {
          const variable = variableFor(sourceCode, node)
          const initializer = variable ? constantInitializer(variable) : undefined
          return initializer ? staticString(initializer, depth + 1) : undefined
        }
        case AST_NODE_TYPES.NewExpression: {
          if (
            node.callee.type !== AST_NODE_TYPES.Identifier ||
            !isGlobalReference(sourceCode, node.callee)
          ) {
            return undefined
          }
          if (node.callee.name !== 'URL' && node.callee.name !== 'Request') {
            return undefined
          }
          const input = staticString(node.arguments[0], depth + 1)
          if (input === undefined) {
            return undefined
          }
          const base =
            node.callee.name === 'URL' ? staticString(node.arguments[1], depth + 1) : undefined
          try {
            return new URL(input, base).href
          } catch {
            return undefined
          }
        }
        case AST_NODE_TYPES.MemberExpression:
          if (
            !node.computed &&
            node.property.type === AST_NODE_TYPES.Identifier &&
            (node.property.name === 'href' || node.property.name === 'url')
          ) {
            return staticString(node.object, depth + 1)
          }
          return undefined
        case AST_NODE_TYPES.CallExpression:
          if (
            node.callee.type === AST_NODE_TYPES.MemberExpression &&
            !node.callee.computed &&
            node.callee.property.type === AST_NODE_TYPES.Identifier &&
            node.callee.property.name === 'toString' &&
            node.arguments.length === 0
          ) {
            return staticString(node.callee.object, depth + 1)
          }
          return undefined
        case AST_NODE_TYPES.TSAsExpression:
        case AST_NODE_TYPES.TSSatisfiesExpression:
        case AST_NODE_TYPES.TSNonNullExpression:
          return staticString(node.expression, depth + 1)
        default:
          return undefined
      }
    }

    /** Whether an expression is the global `fetch` (directly, through a global object, or a const alias). */
    const isGlobalFetch = (node: TSESTree.Node, depth = 0): boolean => {
      if (depth > 4) {
        return false
      }
      if (node.type === AST_NODE_TYPES.Identifier) {
        if (node.name === 'fetch' && isGlobalReference(sourceCode, node)) {
          return true
        }
        const variable = variableFor(sourceCode, node)
        if (!variable) {
          return false
        }
        const [definition] = variable.defs
        if (
          definition?.type === TSESLint.Scope.DefinitionType.Variable &&
          definition.node.parent.kind === 'const'
        ) {
          const declarator = definition.node
          if (declarator.id.type === AST_NODE_TYPES.Identifier && declarator.init) {
            return isGlobalFetch(declarator.init, depth + 1)
          }
          // `const { fetch: send } = globalThis`
          if (
            declarator.id.type === AST_NODE_TYPES.ObjectPattern &&
            declarator.init?.type === AST_NODE_TYPES.Identifier &&
            GLOBAL_OBJECTS.has(declarator.init.name) &&
            isGlobalReference(sourceCode, declarator.init)
          ) {
            return declarator.id.properties.some(
              (property) =>
                property.type === AST_NODE_TYPES.Property &&
                property.key.type === AST_NODE_TYPES.Identifier &&
                property.key.name === 'fetch' &&
                property.value.type === AST_NODE_TYPES.Identifier &&
                property.value.name === node.name,
            )
          }
        }
        return false
      }
      if (node.type === AST_NODE_TYPES.MemberExpression && !node.computed) {
        return (
          node.property.type === AST_NODE_TYPES.Identifier &&
          node.property.name === 'fetch' &&
          node.object.type === AST_NODE_TYPES.Identifier &&
          GLOBAL_OBJECTS.has(node.object.name) &&
          isGlobalReference(sourceCode, node.object)
        )
      }
      // `fetch.bind(globalThis)`
      if (
        node.type === AST_NODE_TYPES.CallExpression &&
        node.callee.type === AST_NODE_TYPES.MemberExpression &&
        node.callee.property.type === AST_NODE_TYPES.Identifier &&
        node.callee.property.name === 'bind'
      ) {
        return isGlobalFetch(node.callee.object, depth + 1)
      }
      return false
    }

    return {
      CallExpression: (node) => {
        if (engineOrigins.size === 0 || !isGlobalFetch(node.callee)) {
          return
        }
        const target = staticString(node.arguments[0])
        if (target === undefined) {
          return
        }
        let origin: string
        try {
          origin = new URL(target).origin
        } catch {
          return
        }
        if (engineOrigins.has(origin)) {
          context.report({ node, messageId: 'directEngineHttp', data: { origin } })
        }
      },
    }
  },
})
