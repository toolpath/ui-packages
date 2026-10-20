/**
 * Fails when a package other than `@toolpath/ui` and its named exceptions
 * holds a stylesheet, a React view under `src/`, or a styling dependency.
 * `styling-home.mjs` holds the rule and the reason for it.
 */

import { repositoryRoot } from './lib.mjs'
import { findStylingFaults } from './styling-home.mjs'

const { checked, faults } = await findStylingFaults(repositoryRoot)

// A walk that read no package would report a clean tree, which is the failure
// mode this check exists against.
if (checked === 0) {
  process.stderr.write('No packages were read under packages/; this check is proving nothing.\n')
  process.exit(1)
}

if (faults.length > 0) {
  const lines = faults.map(({ where, file, rule }) => `  - ${where}: ${file} — ${rule}`)
  process.stderr.write(
    `Styling outside @toolpath/ui:\n\n${lines.join('\n')}\n\n` +
      'Move it into packages/ui, or name the package in STYLED_PACKAGES in ' +
      'scripts/styling-home.mjs and in AGENTS.md "Where code goes", with the reason.\n',
  )
  process.exit(1)
}

process.stdout.write(`Verified ${checked} packages hold no styling outside @toolpath/ui\n`)
