import React, { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../common'
import { capitalize } from 'lodash-es'

export type AttributionActionProps = HTMLAttributes<HTMLSpanElement> & {
  children?: ReactNode
}

export const Action = ({ className, children = 'created', ...props }: AttributionActionProps) => (
  <span className={cn(className)} {...props}>
    {typeof children === 'string' ? capitalize(children) : children}
  </span>
)
