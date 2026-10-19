import { cn } from '@toolpath/ui'

/** The focus ring every row in these lists shows under the keyboard. */
export const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-info/75'

/** What a rule's words look like: plain text until pointed at, underlined to say they change. */
export const WORD = cn(
  'cursor-pointer appearance-none rounded bg-transparent px-0.5 font-medium text-gray-700 field-sizing-content',
  'underline decoration-gray-300 decoration-dotted underline-offset-4 hover:bg-gray-100',
  'dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:bg-zinc-700',
  'outline-none focus-visible:bg-gray-100 focus-visible:ring-2 focus-visible:ring-info/75 dark:focus-visible:bg-zinc-700',
)
