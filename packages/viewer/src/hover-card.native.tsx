import type { HoverCardProps } from './hover-card.js'

export type { HoverCardProps } from './hover-card.js'

/** Web-only: the card follows a mouse pointer, which a phone does not have. */
export const HoverCard = (_props: HoverCardProps): never => {
  throw new Error('@toolpath/viewer: HoverCard is not available on React Native.')
}
