import React from 'react'
import { Popover } from '@base-ui/react/popover'

/*
  The light card that Callout, HelpPopover and Tour share: its surface and type, and the motion and
  arrow that tie it to its anchor. Internal, and not exported from the package. Kept as lists so each
  component can put its own padding and width between them in the order Callout always had.
*/

/** The card itself: white on a grey ring, zinc in the dark, and its text. */
export const popupSurface = [
  'bg-white dark:bg-zinc-900 ring-1 ring-gray-200 dark:ring-zinc-800 rounded-lg shadow-lg',
  'font-normal font-body text-xs tracking-normal text-gray-700 dark:text-zinc-100',
]

/** How it grows out of its anchor, from whichever side it opened on. */
export const popupMotion = [
  'transition duration-200 ease-in-out',
  'data-[side=top]:origin-bottom',
  'data-[side=bottom]:origin-top',
  'data-[side=left]:origin-right',
  'data-[side=right]:origin-left',
]

/** The arrow pointing at the anchor, drawn in the card's colours. Inside a `Popover.Popup`. */
export const PopupArrow = () => (
  <Popover.Arrow className="flex data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180 data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90">
    <ArrowSvg />
  </Popover.Arrow>
)

const ArrowSvg = (props: React.ComponentProps<'svg'>) => (
  <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
    <path
      d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
      className="fill-white dark:fill-zinc-900"
    />
    <path
      d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
      className="fill-gray-200 dark:fill-zinc-800"
    />
    <path
      d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
      className="fill-none"
    />
  </svg>
)
