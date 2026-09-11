import React, { ReactNode, Ref } from 'react'
import { cn } from '../common'
import { LinkComponentProps, useLinkContext } from './link-context'

export type LinkProps = LinkComponentProps & {
  children: ReactNode
  className?: string
  ref?: Ref<HTMLAnchorElement>
}

export const Link = ({ children, className, ref, ...props }: LinkProps) => {
  const context = useLinkContext()
  const Component = context?.LinkComponent ?? 'a'

  return (
    <Component
      ref={ref}
      className={cn('cursor-pointer text-info underline-offset-2 hover:underline', className)}
      {...props}
    >
      {children}
    </Component>
  )
}
