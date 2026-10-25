import type { Config } from 'prettier'

/**
 * The shared formatting policy. Consumers re-export it unchanged:
 * `export { default } from '@toolpath/dev-config/prettier'`.
 */
const config = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'always',
  endOfLine: 'lf',
  bracketSpacing: true,
  proseWrap: 'preserve',
} satisfies Config

export default config
