import React, { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../common'

export type AttributionByProps = HTMLAttributes<HTMLSpanElement> & {
  children?: ReactNode
}

export const By = ({ className, children, ...props }: AttributionByProps) => {
  if (children == null) {
    return null
  }

  return (
    <>
      {' by '}
      <span className={cn(className)} {...props}>
        {children}
      </span>
    </>
  )
}
