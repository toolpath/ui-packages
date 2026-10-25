/**
 * Rules whose suppression hides a real defect class: unsafe types, unhandled
 * promises, Hooks/compiler correctness, and this package's own policy. They may
 * be suppressed only line by line, with a reason.
 */
export const CRITICAL_RULE_PATTERNS: ReadonlyArray<RegExp> = [
  /^@typescript-eslint\/no-explicit-any$/,
  /^@typescript-eslint\/no-unsafe-/,
  /^@typescript-eslint\/no-floating-promises$/,
  /^@typescript-eslint\/no-misused-promises$/,
  /^@typescript-eslint\/await-thenable$/,
  /^@typescript-eslint\/ban-ts-comment$/,
  /^@typescript-eslint\/no-non-null-assertion$/,
  /^@typescript-eslint\/switch-exhaustiveness-check$/,
  /^@typescript-eslint\/only-throw-error$/,
  /^react-hooks\//,
  /^@eslint-react\/no-leaked-conditional-rendering$/,
  /^@eslint-react\/web-api-no-leaked-/,
  /^toolpath\//,
  /^toolpath-engine\//,
  /^vitest\/no-focused-tests$/,
  /^jest\/no-focused-tests$/,
  /^playwright\/no-focused-test$/,
]

export const isCriticalRule = (rule: string): boolean =>
  CRITICAL_RULE_PATTERNS.some((pattern) => pattern.test(rule))
