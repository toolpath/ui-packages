import { AST_NODE_TYPES, ESLintUtils, TSESLint, type TSESTree } from '@typescript-eslint/utils'

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/toolpath/ui-packages/blob/main/packages/dev-config/docs/engine-testing.md#toolpath-engine${name}`,
)

type Options = [{ origins: Array<string> }]

const GLOBAL_OBJECTS = new Set(['globalThis', 'window', 'self'])
const MAX_DEPTH = 8

/**
 * What static analysis knows about a string: its text, and whether that is the
 * whole value or only a known prefix (a template or concatenation whose later
 * parts are computed at run time).
 */
interface KnownText {
  text: string
  complete: boolean
}

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

/** The initializer of a variable bound exactly once by `const`. */
const constantInitializer = (variable: TSESLint.Scope.Variable): TSESTree.Node | undefined => {
  const [definition] = variable.defs
  if (variable.defs.length !== 1 || definition?.type !== TSESLint.Scope.DefinitionType.Variable) {
    return undefined
  }
  const declarator = definition.node
  if (declarator.parent.kind !== 'const' || declarator.id.type !== AST_NODE_TYPES.Identifier) {
    return undefined
  }
  return declarator.init ?? undefined
}

/** Whether an identifier names the global binding (nothing in scope declares it). */
const isGlobalReference = (
  sourceCode: TSESLint.SourceCode,
  identifier: TSESTree.Identifier,
): boolean => {
  const variable = variableFor(sourceCode, identifier)
  return variable === undefined || variable.defs.length === 0
}

/**
 * The origin a known URL text establishes: the whole URL's, or a prefix's once
 * its authority is terminated by `/`, `?` or `#` (so `https://host` followed by
 * computed text is not enough: it could continue the host name).
 */
export const originOf = ({ text, complete }: KnownText): string | undefined => {
  if (!complete && !/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*[/?#]/i.test(text)) {
    return undefined
  }
  try {
    const origin = new URL(complete ? text : text.replace(/[?#].*$/, '')).origin
    return origin === 'null' ? undefined : origin
  } catch {
    return undefined
  }
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
    const engineOrigins = new Set(
      origins.map((origin) => originOf({ text: origin, complete: true }) ?? origin),
    )

    const concatenate = (
      left: KnownText | undefined,
      right: KnownText | undefined,
    ): KnownText | undefined => {
      if (!left) {
        return undefined
      }
      if (!left.complete) {
        return left
      }
      return right
        ? { text: left.text + right.text, complete: right.complete }
        : { text: left.text, complete: false }
    }

    /** What is statically known about the string an expression produces. */
    const evaluate = (node: TSESTree.Node | null | undefined, depth = 0): KnownText | undefined => {
      if (!node || depth > MAX_DEPTH) {
        return undefined
      }
      switch (node.type) {
        case AST_NODE_TYPES.Literal:
          return typeof node.value === 'string' ? { text: node.value, complete: true } : undefined
        case AST_NODE_TYPES.TemplateLiteral: {
          let known: KnownText = { text: node.quasis[0]?.value.cooked ?? '', complete: true }
          for (let index = 0; index < node.expressions.length; index += 1) {
            const next = concatenate(known, evaluate(node.expressions[index], depth + 1))
            if (!next?.complete) {
              return { text: next?.text ?? known.text, complete: false }
            }
            known = {
              text: next.text + (node.quasis[index + 1]?.value.cooked ?? ''),
              complete: true,
            }
          }
          return known
        }
        case AST_NODE_TYPES.BinaryExpression:
          return node.operator === '+'
            ? concatenate(evaluate(node.left, depth + 1), evaluate(node.right, depth + 1))
            : undefined
        case AST_NODE_TYPES.Identifier: {
          const variable = variableFor(sourceCode, node)
          const initializer = variable ? constantInitializer(variable) : undefined
          return initializer ? evaluate(initializer, depth + 1) : undefined
        }
        case AST_NODE_TYPES.NewExpression: {
          if (
            node.callee.type !== AST_NODE_TYPES.Identifier ||
            !isGlobalReference(sourceCode, node.callee)
          ) {
            return undefined
          }
          if (node.callee.name === 'Request') {
            return evaluate(node.arguments[0], depth + 1)
          }
          if (node.callee.name !== 'URL') {
            return undefined
          }
          const input = evaluate(node.arguments[0], depth + 1)
          const base = node.arguments[1] ? evaluate(node.arguments[1], depth + 1) : undefined
          if (input?.complete) {
            try {
              return {
                text: new URL(input.text, base?.complete ? base.text : undefined).href,
                complete: true,
              }
            } catch {
              return undefined
            }
          }
          // `new URL(`/v1/parts/${id}`, ENGINE)`: a path relative to a known base keeps the base's origin.
          const baseOrigin = base ? originOf(base) : undefined
          if (input && baseOrigin && input.text.startsWith('/') && !input.text.startsWith('//')) {
            return { text: `${baseOrigin}${input.text}`, complete: false }
          }
          return undefined
        }
        case AST_NODE_TYPES.MemberExpression:
          if (
            !node.computed &&
            node.property.type === AST_NODE_TYPES.Identifier &&
            (node.property.name === 'href' || node.property.name === 'url')
          ) {
            return evaluate(node.object, depth + 1)
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
            return evaluate(node.callee.object, depth + 1)
          }
          return undefined
        case AST_NODE_TYPES.TSAsExpression:
        case AST_NODE_TYPES.TSSatisfiesExpression:
        case AST_NODE_TYPES.TSNonNullExpression:
          return evaluate(node.expression, depth + 1)
        default:
          return undefined
      }
    }

    /** Whether an expression is the global `fetch`: directly, through a global object, or a `const` alias. */
    const isGlobalFetch = (node: TSESTree.Node, depth = 0): boolean => {
      if (depth > MAX_DEPTH) {
        return false
      }
      if (node.type === AST_NODE_TYPES.Identifier) {
        if (node.name === 'fetch' && isGlobalReference(sourceCode, node)) {
          return true
        }
        const variable = variableFor(sourceCode, node)
        const [definition] = variable?.defs ?? []
        if (
          variable?.defs.length !== 1 ||
          definition?.type !== TSESLint.Scope.DefinitionType.Variable
        ) {
          return false
        }
        const declarator = definition.node
        if (declarator.parent.kind !== 'const') {
          return false
        }
        if (declarator.id.type === AST_NODE_TYPES.Identifier && declarator.init) {
          return isGlobalFetch(declarator.init, depth + 1)
        }
        // `const { fetch: send } = globalThis`
        return (
          declarator.id.type === AST_NODE_TYPES.ObjectPattern &&
          declarator.init?.type === AST_NODE_TYPES.Identifier &&
          GLOBAL_OBJECTS.has(declarator.init.name) &&
          isGlobalReference(sourceCode, declarator.init) &&
          declarator.id.properties.some(
            (property) =>
              property.type === AST_NODE_TYPES.Property &&
              property.key.type === AST_NODE_TYPES.Identifier &&
              property.key.name === 'fetch' &&
              property.value.type === AST_NODE_TYPES.Identifier &&
              property.value.name === node.name,
          )
        )
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
        !node.callee.computed &&
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
        const target = evaluate(node.arguments[0])
        const origin = target ? originOf(target) : undefined
        if (origin !== undefined && engineOrigins.has(origin)) {
          context.report({ node, messageId: 'directEngineHttp', data: { origin } })
        }
      },
    }
  },
})
