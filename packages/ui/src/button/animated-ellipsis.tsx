import React from 'react'
import { Svg } from '../common'
import { cn } from '../common'

export type AnimatedEllipsisProps = {
  className?: string
}

export const AnimatedEllipsis = ({ className }: AnimatedEllipsisProps) => (
  <div className="mx-auto inline-block">
    <div className="flex items-center">
      <Svg
        viewBox="0 0 24 24"
        className={cn(
          'opacity-85 mx-1 h-3 w-3',
          className,
          'animate-[pulse_1.5s_ease-in-out_infinite]',
        )}
      >
        <circle cx="12" cy="12" r="12" />
      </Svg>
      <Svg
        viewBox="0 0 24 24"
        className={cn(
          'opacity-85 mx-1 h-3 w-3',
          className,
          'animate-[pulse_1.5s_ease-in-out_0.5s_infinite]',
        )}
      >
        <circle cx="12" cy="12" r="12" />
      </Svg>
      <Svg
        viewBox="0 0 24 24"
        className={cn(
          'opacity-85 mx-1 h-3 w-3',
          className,
          'animate-[pulse_1.5s_ease-in-out_1.5s_infinite]',
        )}
      >
        <circle cx="12" cy="12" r="12" />
      </Svg>
    </div>
  </div>
)
