/** The shipped source the styling ban reads. */
export const STYLING_SOURCE: ReadonlyArray<string> = ['src/**/*.ts', 'src/**/*.tsx']

/** Import specifiers only a styled package may name, as `no-restricted-imports` patterns. */
export const STYLING_IMPORTS: ReadonlyArray<string> = [
  '@toolpath/ui',
  '@toolpath/ui/*',
  '@phosphor-icons/*',
  '@base-ui/*',
  'tailwindcss',
  '@tailwindcss/*',
  'clsx',
  'tailwind-merge',
  '*.css',
  '*.scss',
  '*.less',
]

export const STYLING_IMPORT_MESSAGE =
  'Styling belongs in @toolpath/ui. This package ships logic, data types and functions.'

export const STYLING_MESSAGE = 'Styling belongs in @toolpath/ui. Move this view into packages/ui.'
