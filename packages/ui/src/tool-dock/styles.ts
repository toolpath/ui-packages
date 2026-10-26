/*
 * The dock is dark in either theme, so these classes carry no `dark:` variant.
 * It floats over the 3D view, which lights itself, and a bar that turned white
 * with the page would be the brightest thing over the part. Its root and each
 * popup it opens, which sits outside the root, carry `dark`, so kit controls
 * in them take their dark look too. Its tooltips are its own (`dock-tooltip.tsx`).
 *
 * Nothing in it is white or blue: a tool that is on, an open menu and a switch
 * that is on are each a lighter gray than what is around them.
 */

/** The bar's plate, which its tooltips share. */
const PLATE = 'border border-zinc-800 bg-zinc-950/90 text-zinc-100 shadow-lg backdrop-blur-sm'

export const SURFACE = `rounded-lg ${PLATE}`

export const POPOVER = 'dark rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-lg'

export const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-zinc-300'

export const BAR_BUTTON =
  'flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-zinc-50 [&_svg]:size-5'

export const PRESSED = 'bg-zinc-700 text-zinc-50 hover:bg-zinc-700'

export const OPEN = 'bg-zinc-800 text-zinc-50'

export const GATED = 'text-zinc-500 hover:text-zinc-300'

export const HEADING =
  'px-2 pt-2 pb-1 text-3xs font-semibold tracking-wider text-zinc-400 uppercase'

export const NOTE = 'text-2xs font-normal text-zinc-400'

/** A tooltip's plate: the bar's own. */
export const TIP = `max-w-72 rounded-md px-3 py-1 font-body text-xs font-medium break-words ${PLATE}`

/** A tool's pin, beside its row in All tools or a group's menu: brighter while the tool is on the bar. */
export const pinLook = (pinned: boolean): string =>
  `grid size-7 shrink-0 cursor-pointer place-items-center rounded transition-colors hover:bg-zinc-800 ${
    pinned ? 'text-zinc-50' : 'text-zinc-500 hover:text-zinc-200 data-[highlighted]:text-zinc-200'
  }`
