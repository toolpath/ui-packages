import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import type { PartPick, PointerLocation } from './render/picking.js'

export interface HoverCardProps {
  /** The current `onHover` pick, or `null` after the pointer leaves the part. */
  pick: PartPick | null
  /** Card content belongs to the application that understands the feature data. */
  children: (pick: PartPick) => ReactNode
  className?: string
  offset?: number
}

/** A cursor-following shell for an application-owned part hover card. */
export const HoverCard = ({ pick, children, className, offset = 16 }: HoverCardProps) => {
  const [pointer, setPointer] = useState<PointerLocation | undefined>(pick?.pointer)

  useEffect(() => {
    setPointer(pick?.pointer)
    if (pick === null) return

    const follow = (event: PointerEvent) =>
      setPointer({ clientX: event.clientX, clientY: event.clientY })
    window.addEventListener('pointermove', follow)
    return () => window.removeEventListener('pointermove', follow)
  }, [pick])

  if (pick === null || pointer === undefined) return null

  const style: CSSProperties = {
    position: 'fixed',
    left: pointer.clientX + offset,
    top: pointer.clientY + offset,
    pointerEvents: 'none',
    zIndex: 4,
  }

  return (
    <div className={className} role="tooltip" style={style}>
      {children(pick)}
    </div>
  )
}
