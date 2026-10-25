// The result action. Two places use it:
//
// - inside the central reusable workflow, with `plan` and `receipts`: the
//   plan, standards and suites jobs finished as the plan requires and every
//   required receipt exists and passed. Its `receipt` output is what the caller
//   sees as the standards job's result;
// - as the caller's always-running `quality` job, with `required`: every
//   required predecessor succeeded and published a verified receipt.
//
// It installs nothing and reads only JSON inputs and receipt files.
import { resolve } from 'node:path'
import { renderMarkdown, verifyAggregate, verifyWorkflow } from '../result-policy.mjs'
import {
  error,
  input,
  notice,
  readReceiptDirectory,
  setOutput,
  stdout,
  summary,
} from './runtime.mjs'

/**
 * @param {NodeJS.ProcessEnv} [environment]
 * @param {import('./runtime.mjs').Log} [log] where workflow commands go
 * @returns {number} the exit code
 */
export const run = (environment = process.env, log = stdout) => {
  const needs = input('needs', environment)
  const plan = input('plan', environment)
  const required = input('required', environment)
  const receiptsDirectory = input('receipts', environment)
  if ((plan === '') === (required === '')) {
    error(
      'dev-config-result: give either `plan` and `receipts` (central workflow) or `required` (caller aggregate)',
      log,
    )
    return 2
  }
  if (plan !== '') {
    if (receiptsDirectory === '') {
      error('dev-config-result: `plan` needs the `receipts` directory it verifies', log)
      return 2
    }
    const verdict = verifyWorkflow({
      needs,
      plan,
      receipts: readReceiptDirectory(resolve(receiptsDirectory)),
    })
    summary(
      renderMarkdown('dev-config standards', verdict, verdict.summary?.receipts ?? []),
      environment,
    )
    for (const message of verdict.errors) {
      error(message, log)
    }
    for (const message of verdict.notes) {
      notice(message, log)
    }
    if (!verdict.ok || !verdict.summary) {
      return 1
    }
    setOutput('receipt', JSON.stringify(verdict.summary), environment)
    return 0
  }
  const verdict = verifyAggregate({ needs, required })
  summary(renderMarkdown('quality', verdict), environment)
  for (const message of verdict.errors) {
    error(message, log)
  }
  for (const message of verdict.notes) {
    notice(message, log)
  }
  return verdict.ok ? 0 : 1
}

export const main = () => {
  try {
    process.exitCode = run()
  } catch (failure) {
    error(`dev-config-result: ${failure instanceof Error ? failure.message : String(failure)}`)
    process.exitCode = 1
  }
}
