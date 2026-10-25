import { ESLintUtils } from '@typescript-eslint/utils'

/** Rule documentation lives in the package's `docs/policy.md`, one anchor per rule. */
export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/toolpath/ui-packages/blob/main/packages/dev-config/docs/policy.md#toolpath${name}`,
)
