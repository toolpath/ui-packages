import type { HoverCardProps } from '../hover-card.js'
import { webOnly } from '../render/web-only.js'

export type { HoverCardProps } from '../hover-card.js'

/** Web-only: the card follows a mouse pointer, which a phone does not have. */
export const HoverCard = (_props: HoverCardProps): never => webOnly('HoverCard')
