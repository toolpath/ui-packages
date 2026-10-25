import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils'
import { createRule } from '../create-rule.js'

const OPT_OUT_DIRECTIVES = new Set(['use no memo', 'use no forget'])
const MINIMUM_REASON = 10

/** Statements in directive position: the prologue of a program or a function body. */
const prologue = (body: ReadonlyArray<TSESTree.Node>): Array<TSESTree.ExpressionStatement> => {
  const directives: Array<TSESTree.ExpressionStatement> = []
  for (const statement of body) {
    if (
      statement.type !== AST_NODE_TYPES.ExpressionStatement ||
      typeof statement.directive !== 'string'
    ) {
      break
    }
    directives.push(statement)
  }
  return directives
}

export const requireCompilerOptoutReason = createRule<[], 'missingReason'>({
  name: 'require-compiler-optout-reason',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a React Compiler opt-out directive to carry an adjacent comment naming the incompatibility or boundary.',
    },
    messages: {
      missingReason:
        '"{{directive}}" turns off React Compiler here. Put a comment on the line above (or at the end of this line) saying which incompatibility or deliberate boundary requires it.',
    },
    schema: [],
  },
  defaultOptions: [],
  create: (context) => {
    const sourceCode = context.sourceCode
    const explained = (statement: TSESTree.ExpressionStatement): boolean => {
      const before = sourceCode.getCommentsBefore(statement).at(-1)
      const after = sourceCode
        .getCommentsAfter(statement)
        .find((comment) => comment.loc.start.line === statement.loc.end.line)
      const adjacentBefore =
        before && before.loc.end.line >= statement.loc.start.line - 1 ? before : undefined
      return [adjacentBefore, after].some(
        (comment) => comment !== undefined && comment.value.trim().length >= MINIMUM_REASON,
      )
    }
    const check = (body: ReadonlyArray<TSESTree.Node>): void => {
      for (const statement of prologue(body)) {
        if (
          statement.directive !== undefined &&
          OPT_OUT_DIRECTIVES.has(statement.directive) &&
          !explained(statement)
        ) {
          context.report({
            node: statement,
            messageId: 'missingReason',
            data: { directive: statement.directive },
          })
        }
      }
    }
    const checkFunction = (
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ): void => {
      if (node.body.type === AST_NODE_TYPES.BlockStatement) {
        check(node.body.body)
      }
    }
    return {
      Program: (node) => {
        check(node.body)
      },
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    }
  },
})
